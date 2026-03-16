import datetime
import random
import string

from geopy.geocoders import options, Nominatim
from sqlalchemy import (
    Column,
    Float,
    Integer,
    Interval,
    String,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()


# random user name 8 letters
def randomword():
    letters = string.ascii_lowercase
    return "".join(random.choice(letters) for i in range(4))


options.default_user_agent = "running_page"
# reverse the location (lat, lon) -> location detail
g = Nominatim(user_agent=randomword())

# global cache for location to avoid redundant reverse geocoding
_LOCATION_CACHE = {}

def get_location_country(lat, lon):
    # Use a precision of 2 decimal places (~1.1km) for better cache hit rate while maintaining location accuracy
    key = (round(lat, 2), round(lon, 2))
    if key in _LOCATION_CACHE:
        return _LOCATION_CACHE[key]
    
    try:
        location = g.reverse(f"{lat}, {lon}", language="zh-CN")
        country = str(location) if location else ""
        _LOCATION_CACHE[key] = country
        return country
    except Exception:
        # Retry once on failure
        try:
            location = g.reverse(f"{lat}, {lon}", language="zh-CN")
            country = str(location) if location else ""
            _LOCATION_CACHE[key] = country
            return country
        except Exception:
            return ""

ACTIVITY_KEYS = [
    "run_id",
    "name",
    "distance",
    "moving_time",
    "type",
    "subtype",
    "start_date",
    "start_date_local",
    "location_country",
    "location_city",
    "summary_polyline",
    "average_heartrate",
    "average_speed",
    "elevation_gain",
    "max_heartrate",
    "average_cadence",
    "average_watts",
    "max_speed",
    "ext_data",
    "commute",
    "workout_type",
]


class Activity(Base):
    __tablename__ = "activities"

    run_id = Column(Integer, primary_key=True)
    name = Column(String)
    distance = Column(Float)
    moving_time = Column(Interval)
    elapsed_time = Column(Interval)
    type = Column(String, index=True)
    subtype = Column(String)
    start_date = Column(String, index=True)
    start_date_local = Column(String, index=True)
    location_country = Column(String)
    location_city = Column(String)
    summary_polyline = Column(String)
    average_heartrate = Column(Float)
    average_speed = Column(Float)
    elevation_gain = Column(Float)
    max_heartrate = Column(Float)
    average_cadence = Column(Float)
    average_watts = Column(Float)
    max_speed = Column(Float)
    ext_data = Column(String)  # JSON string for flexible data
    commute = Column(Integer)
    workout_type = Column(Integer)
    streak = None

    def to_dict(self):
        out = {}
        for key in ACTIVITY_KEYS:
            attr = getattr(self, key)
            if isinstance(attr, (datetime.timedelta, datetime.datetime)):
                out[key] = str(attr)
            else:
                out[key] = attr

        if self.streak:
            out["streak"] = self.streak

        return out


class Photo(Base):
    __tablename__ = "photos"

    id = Column(String, primary_key=True)
    activity_id = Column(Integer, index=True)
    local_path = Column(String)
    remote_url = Column(String)
    title = Column(String)
    date = Column(String)
    type = Column(String)
    location_country = Column(String)
    ext_data = Column(String)

    def to_dict(self):
        return {
            "id": self.id,
            "activity_id": self.activity_id,
            "url": f"/static/photos/{os.path.basename(self.local_path)}" if self.local_path else self.remote_url,
            "title": self.title,
        }


class Trophy(Base):
    __tablename__ = "trophies"

    id = Column(String, primary_key=True)
    name = Column(String)
    image = Column(String)
    color = Column(String)
    progress = Column(String)
    type = Column(String)
    month = Column(String)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "image": self.image,
            "color": self.color,
            "progress": self.progress,
            "type": self.type,
            "month": self.month,
        }


class Segment(Base):
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    distance = Column(Float)
    average_grade = Column(Float)
    maximum_grade = Column(Float)
    elevation_high = Column(Float)
    elevation_low = Column(Float)
    city = Column(String)
    state = Column(String)
    country = Column(String)
    climb_category = Column(Integer)
    total_elevation_gain = Column(Float)
    map_polyline = Column(String)
    effort_count = Column(Integer, default=0)
    best_time = Column(Interval)
    best_date = Column(String)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "distance": self.distance,
            "average_grade": self.average_grade,
            "maximum_grade": self.maximum_grade,
            "elevation_high": self.elevation_high,
            "elevation_low": self.elevation_low,
            "city": self.city,
            "state": self.state,
            "country": self.country,
            "climb_category": self.climb_category,
            "total_elevation_gain": self.total_elevation_gain,
            "map_polyline": self.map_polyline,
            "effort_count": self.effort_count,
            "best_time": str(self.best_time) if self.best_time else None,
            "best_date": self.best_date,
        }


class SegmentEffort(Base):
    __tablename__ = "segment_efforts"

    id = Column(Integer, primary_key=True)
    segment_id = Column(Integer, index=True)
    activity_id = Column(Integer, index=True)
    name = Column(String)
    elapsed_time = Column(Interval)
    moving_time = Column(Interval)
    start_date = Column(String)
    start_date_local = Column(String)
    distance = Column(Float)
    average_cadence = Column(Float)
    average_watts = Column(Float)
    average_heartrate = Column(Float)
    max_heartrate = Column(Float)
    kom_rank = Column(Integer)
    pr_rank = Column(Integer)

    def to_dict(self):
        return {
            "id": self.id,
            "segment_id": self.segment_id,
            "activity_id": self.activity_id,
            "name": self.name,
            "elapsed_time": str(self.elapsed_time),
            "moving_time": str(self.moving_time),
            "start_date": self.start_date,
            "start_date_local": self.start_date_local,
            "distance": self.distance,
            "average_cadence": self.average_cadence,
            "average_watts": self.average_watts,
            "average_heartrate": self.average_heartrate,
            "max_heartrate": self.max_heartrate,
            "kom_rank": self.kom_rank,
            "pr_rank": self.pr_rank,
        }


def update_or_create_activity(session, run_activity):
    created = False
    try:
        activity = (
            session.query(Activity).filter_by(run_id=int(run_activity.id)).first()
        )

        current_elevation_gain = 0.0  # default value

        # https://github.com/stravalib/stravalib/blob/main/src/stravalib/strava_model.py#L639C1-L643C41
        if (
            hasattr(run_activity, "total_elevation_gain")
            and run_activity.total_elevation_gain is not None
        ):
            current_elevation_gain = float(run_activity.total_elevation_gain)
        elif (
            hasattr(run_activity, "elevation_gain")
            and run_activity.elevation_gain is not None
        ):
            current_elevation_gain = float(run_activity.elevation_gain)

        if not activity:
            start_point = run_activity.start_latlng
            location_country = getattr(run_activity, "location_country", "")
            # or China for #176 to fix
            if not location_country and start_point or location_country == "China":
                location_country = get_location_country(start_point.lat, start_point.lon)

            activity = Activity(
                run_id=run_activity.id,
                name=run_activity.name,
                distance=run_activity.distance,
                moving_time=run_activity.moving_time,
                elapsed_time=run_activity.elapsed_time,
                type=run_activity.type,
                subtype=run_activity.subtype,
                start_date=run_activity.start_date,
                start_date_local=run_activity.start_date_local,
                location_country=location_country,
                location_city=getattr(run_activity, "location_city", ""),
                average_heartrate=run_activity.average_heartrate,
                average_speed=float(run_activity.average_speed),
                elevation_gain=current_elevation_gain,
                summary_polyline=(
                    run_activity.map and run_activity.map.summary_polyline or ""
                ),
                max_heartrate=getattr(run_activity, "max_heartrate", None),
                average_cadence=getattr(run_activity, "average_cadence", None),
                average_watts=getattr(run_activity, "average_watts", None),
                max_speed=getattr(run_activity, "max_speed", None),
                ext_data=getattr(run_activity, "ext_data", None),
                commute=int(getattr(run_activity, "commute", False)),
                workout_type=getattr(run_activity, "workout_type", None),
            )
            session.add(activity)
            created = True
        else:
            activity.name = run_activity.name
            activity.distance = float(run_activity.distance)
            activity.moving_time = run_activity.moving_time
            activity.elapsed_time = run_activity.elapsed_time
            activity.type = run_activity.type
            activity.subtype = run_activity.subtype
            activity.average_heartrate = run_activity.average_heartrate
            activity.average_speed = float(run_activity.average_speed)
            activity.elevation_gain = current_elevation_gain
            activity.summary_polyline = (
                run_activity.map and run_activity.map.summary_polyline or ""
            )
            activity.max_heartrate = getattr(run_activity, "max_heartrate", None)
            activity.average_cadence = getattr(run_activity, "average_cadence", None)
            activity.average_watts = getattr(run_activity, "average_watts", None)
            activity.max_speed = getattr(run_activity, "max_speed", None)
            activity.ext_data = getattr(run_activity, "ext_data", None)
            activity.commute = int(getattr(run_activity, "commute", False))
            activity.workout_type = getattr(run_activity, "workout_type", None)
    except Exception as e:
        print(f"something wrong with {run_activity.id}")
        print(str(e))

def get_any_val(obj, attr_name, default=0.0):
    val = getattr(obj, attr_name, None)
    if val is None:
        return default
    # Handle stravalib Quantity objects (which can behave like tuples)
    if hasattr(val, "num"):
        return float(val.num)
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def update_or_create_segment(session, strava_segment):
    segment = session.query(Segment).filter_by(id=strava_segment.id).first()
    if not segment:
        segment = Segment(
            id=strava_segment.id,
            name=strava_segment.name,
            distance=get_any_val(strava_segment, "distance"),
            average_grade=get_any_val(strava_segment, "average_grade"),
            maximum_grade=get_any_val(strava_segment, "maximum_grade"),
            elevation_high=get_any_val(strava_segment, "elevation_high"),
            elevation_low=get_any_val(strava_segment, "elevation_low"),
            city=strava_segment.city,
            state=strava_segment.state,
            country=strava_segment.country,
            climb_category=strava_segment.climb_category,
            total_elevation_gain=get_any_val(strava_segment, "total_elevation_gain"),
            map_polyline=getattr(getattr(strava_segment, "map", {}), "polyline", "") or "",
        )
        session.add(segment)
    else:
        segment.name = strava_segment.name
        segment.distance = get_any_val(strava_segment, "distance")
        segment.average_grade = get_any_val(strava_segment, "average_grade")
        # ... update other fields if needed
    
    return segment


def update_or_create_segment_effort(session, strava_effort, activity_id):
    effort = session.query(SegmentEffort).filter_by(id=strava_effort.id).first()
    
    # Extract segment info and update it first
    seg_obj = update_or_create_segment(session, strava_effort.segment)
    
    if not effort:
        effort = SegmentEffort(
            id=strava_effort.id,
            segment_id=strava_effort.segment.id,
            activity_id=activity_id,
            name=strava_effort.name,
            elapsed_time=strava_effort.elapsed_time,
            moving_time=strava_effort.moving_time,
            start_date=strava_effort.start_date.isoformat() if hasattr(strava_effort.start_date, 'isoformat') else str(strava_effort.start_date),
            start_date_local=strava_effort.start_date_local.isoformat() if hasattr(strava_effort.start_date_local, 'isoformat') else str(strava_effort.start_date_local),
            distance=get_any_val(strava_effort, "distance"),
            average_cadence=get_any_val(strava_effort, "average_cadence", None),
            average_watts=get_any_val(strava_effort, "average_watts", None),
            average_heartrate=get_any_val(strava_effort, "average_heartrate", None),
            max_heartrate=get_any_val(strava_effort, "max_heartrate", None),
            kom_rank=strava_effort.kom_rank,
            pr_rank=strava_effort.pr_rank
        )
        session.add(effort)
        
        # Ensure seg_obj fields are initialized
        if seg_obj.effort_count is None: seg_obj.effort_count = 0
        
        # Update segment's best stats if this effort is better
        if not seg_obj.best_time or strava_effort.moving_time < seg_obj.best_time:
            seg_obj.best_time = strava_effort.moving_time
            seg_obj.best_date = strava_effort.start_date_local.strftime("%Y-%m-%d") if hasattr(strava_effort.start_date_local, 'strftime') else str(strava_effort.start_date_local)[:10]
        
        seg_obj.effort_count += 1


def add_missing_columns(engine, model):
    inspector = inspect(engine)
    table_name = model.__tablename__
    columns = {col["name"] for col in inspector.get_columns(table_name)}
    missing_columns = []

    for column in model.__table__.columns:
        if column.name not in columns:
            missing_columns.append(column)
    if missing_columns:
        with engine.connect() as conn:
            for column in missing_columns:
                column_type = str(column.type)
                conn.execute(
                    text(
                        f"ALTER TABLE {table_name} ADD COLUMN {column.name} {column_type}"
                    )
                )


def init_db(db_path):
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)

    # check missing columns
    add_missing_columns(engine, Activity)
    add_missing_columns(engine, Segment)
    add_missing_columns(engine, SegmentEffort)
    add_missing_columns(engine, Trophy)

    sm = sessionmaker(bind=engine)
    session = sm()
    # apply the changes
    session.commit()
    return session
