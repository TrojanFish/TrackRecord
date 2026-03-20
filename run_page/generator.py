import datetime
import logging
import os
import sys
import time

import arrow
import stravalib
try:
    from gpxtrackposter import track_loader
except ImportError:
    track_loader = None

from sqlalchemy import func
from run_page.polyline_processor import filter_out
from run_page.db import Activity, init_db, update_or_create_activity, update_or_create_segment_effort

from run_page.synced_data_file_logger import save_synced_data_file_list

logger = logging.getLogger(__name__)

IGNORE_BEFORE_SAVING = os.getenv("IGNORE_BEFORE_SAVING", False)

# Strava API limits: 100 req/15 min, 1000 req/day.
# When rate limited (429), sleep until the next 15-min window resets.
_RATE_LIMIT_SLEEP = 900  # seconds (15 minutes)
_RATE_LIMIT_KEYWORDS = ("rate limit", "429", "too many", "ratelimit")


def _is_rate_limit_error(exc: Exception) -> bool:
    return any(kw in str(exc).lower() for kw in _RATE_LIMIT_KEYWORDS)


def _strava_call(fn, *args, max_retries: int = 2, **kwargs):
    """Call a Strava API function, retrying up to max_retries times on rate-limit errors."""
    for attempt in range(max_retries + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            if attempt < max_retries and _is_rate_limit_error(exc):
                logger.warning("Strava rate limit hit — sleeping %ds (attempt %d/%d)",
                               _RATE_LIMIT_SLEEP, attempt + 1, max_retries)
                time.sleep(_RATE_LIMIT_SLEEP)
            else:
                raise


class Generator:
    def __init__(self, db_path):
        self.client = stravalib.Client()
        self.session = init_db(db_path)

        self.client_id = ""
        self.client_secret = ""
        self.refresh_token = ""
        self.only_run = False

    def close(self):
        """Explicitly close the database session."""
        if hasattr(self, "session") and self.session:
            self.session.close()

    def __del__(self):
        """Ensure session is closed on destruction."""
        self.close()

    def set_strava_config(self, client_id, client_secret, refresh_token):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token

    def check_access(self):
        """Refresh the Strava access token and persist any rotated refresh token."""
        response = self.client.refresh_access_token(
            client_id=self.client_id,
            client_secret=self.client_secret,
            refresh_token=self.refresh_token,
        )
        self.client.access_token = response["access_token"]
        self.access_token = response["access_token"]

        # Strava rotates refresh tokens — persist the new one so auth survives restarts.
        new_refresh = response.get("refresh_token") or self.refresh_token
        if new_refresh and new_refresh != self.refresh_token:
            self.refresh_token = new_refresh
            try:
                from run_page.auth import load_creds, save_creds
                creds = load_creds()
                creds["strava_refresh_token"] = new_refresh
                save_creds(creds)
                logger.info("Rotated refresh token persisted to credentials.json")
            except Exception as save_err:
                logger.warning("Failed to persist rotated refresh token: %s", save_err)

        logger.info("Strava access token refreshed.")

    def sync(self, force):
        """
        Sync activities means sync from strava
        TODO, better name later
        """
        self.check_access()
        
        print("Pre-fetching existing activity IDs...")
        old_ids = set(self.get_old_tracks_ids())
        print(f"Found {len(old_ids)} existing activities.")

        print("Start syncing ('.' = skip/update, '+' = new)")
        if force:
            filters = {"before": datetime.datetime.now(datetime.timezone.utc)}
        else:
            last_activity = self.session.query(func.max(Activity.start_date)).scalar()
            if last_activity:
                last_activity_date = arrow.get(last_activity)
                last_activity_date = last_activity_date.shift(days=-7)
                filters = {"after": last_activity_date.datetime}
            else:
                filters = {"before": datetime.datetime.now(datetime.timezone.utc)}

        # per_page=200 is the Strava API maximum (default is 30 — 6.7× more calls).
        activities = list(_strava_call(self.client.get_activities, per_page=200, **filters))
        total_count = len(activities)
        logger.info("Total activities to process: %d", total_count)

        for index, activity in enumerate(activities, 1):
            run_id = str(activity.id)
            if self.only_run and activity.type != "Run":
                continue

            # Skip full processing if activity exists and not forced
            if not force and run_id in old_ids:
                sys.stdout.write(".")
                sys.stdout.flush()
                continue

            logger.info("[%d/%d] Processing: %s (%s)", index, total_count, activity.name, activity.start_date_local)

            if IGNORE_BEFORE_SAVING:
                if activity.map and activity.map.summary_polyline:
                    activity.map.summary_polyline = filter_out(
                        activity.map.summary_polyline
                    )
            activity.elevation_gain = activity.total_elevation_gain
            activity.subtype = activity.type

            created = update_or_create_activity(self.session, activity)
            if created:
                # Fetch detailed activity to retrieve segment efforts (1 API call per new activity)
                try:
                    detail = _strava_call(self.client.get_activity, activity.id)
                    if hasattr(detail, 'segment_efforts') and detail.segment_efforts:
                        logger.info("  - Found %d segment efforts", len(detail.segment_efforts))
                        for effort in detail.segment_efforts:
                            update_or_create_segment_effort(self.session, effort, activity.id)
                except Exception as exc:
                    logger.warning("  - Error fetching segments for activity %s: %s", activity.id, exc)

                logger.info("  - Saved to database")
                old_ids.add(run_id)
            else:
                sys.stdout.write(".")
            sys.stdout.flush()

        # NOTE: sync_segments() for historical backfill is intentionally NOT called here.
        # The caller (_run_full_sync) is responsible for deciding backfill scope/limit.
        self.session.commit()

    def sync_from_data_dir(self, data_dir, file_suffix="gpx", activity_title_dict={}):
        if not track_loader:
            print("Error: gpxtrackposter not installed. Cannot sync from data dir.")
            return
        loader = track_loader.TrackLoader()
        tracks = loader.load_tracks(
            data_dir, file_suffix=file_suffix, activity_title_dict=activity_title_dict
        )
        print(f"load {len(tracks)} tracks")
        if not tracks:
            print("No tracks found.")
            return

        synced_files = []

        for t in tracks:
            created = update_or_create_activity(
                self.session, t.to_namedtuple(run_from=file_suffix)
            )
            if created:
                sys.stdout.write("+")
            else:
                sys.stdout.write(".")
            synced_files.extend(t.file_names)
            sys.stdout.flush()

        save_synced_data_file_list(synced_files)

        self.session.commit()

    def sync_from_app(self, app_tracks):
        if not app_tracks:
            print("No tracks found.")
            return
        print("Syncing tracks '+' means new track '.' means update tracks")
        synced_files = []
        for t in app_tracks:
            created = update_or_create_activity(self.session, t)
            if created:
                sys.stdout.write("+")
            else:
                sys.stdout.write(".")
            if "file_names" in t:
                synced_files.extend(t.file_names)
            sys.stdout.flush()

        self.session.commit()

    def load(self):
        # if sub_type is not in the db, just add an empty string to it
        query = self.session.query(Activity).filter(Activity.distance > 0.1)
        if self.only_run:
            query = query.filter(Activity.type == "Run")

        activities = query.order_by(Activity.start_date_local)
        activity_list = []

        streak = 0
        last_date = None
        for activity in activities:
            # Determine running streak.
            date = datetime.datetime.strptime(
                activity.start_date_local, "%Y-%m-%d %H:%M:%S"  # type: ignore
            ).date()
            if last_date is None:
                streak = 1
            elif date == last_date:
                pass
            elif date == last_date + datetime.timedelta(days=1):
                streak += 1
            else:
                assert date > last_date
                streak = 1
            activity.streak = streak  # type: ignore
            last_date = date
            if not IGNORE_BEFORE_SAVING:
                activity.summary_polyline = filter_out(activity.summary_polyline)  # type: ignore
            activity_list.append(activity.to_dict())

        return activity_list

    def get_old_tracks_ids(self):
        try:
            # Query only the run_id column for performance
            return [str(item[0]) for item in self.session.query(Activity.run_id).all()]
        except Exception as e:
            # pass the error
            print(f"something wrong with {str(e)}")
            return []

    def get_old_tracks_dates(self):
        try:
            activities = (
                self.session.query(Activity)
                .order_by(Activity.start_date_local.desc())
                .all()
            )
            return [str(a.start_date_local) for a in activities]
        except Exception as e:
            # pass the error
            print(f"something wrong with {str(e)}")
            return []

    def sync_segments(self, limit=10):
        """Specifically sync segments for existing activities that don't have them."""
        from run_page.db import SegmentEffort
        self.check_access()
        
        # Find activities that don't have any segment efforts yet
        # Using a subquery for performance
        has_segments = self.session.query(SegmentEffort.activity_id).distinct()
        activities = self.session.query(Activity).filter(~Activity.run_id.in_(has_segments)).order_by(Activity.start_date.desc()).limit(limit).all()
        
        if not activities:
            logger.info("No activities found missing segment data.")
            return

        logger.info("Syncing segments for %d activities...", len(activities))
        for a in activities:
            try:
                detail = _strava_call(self.client.get_activity, a.run_id)
                if hasattr(detail, 'segment_efforts') and detail.segment_efforts:
                    for effort in detail.segment_efforts:
                        update_or_create_segment_effort(self.session, effort, a.run_id)
                    sys.stdout.write("S")
                else:
                    sys.stdout.write(".")
                sys.stdout.flush()
            except Exception as exc:
                logger.warning("Error fetching segments for activity %s: %s", a.run_id, exc)
                sys.stdout.write("E")
        self.session.commit()
        logger.info("Segment sync complete.")
