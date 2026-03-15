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
            "date": self.date,
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

    return created


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

    sm = sessionmaker(bind=engine)
    session = sm()
    # apply the changes
    session.commit()
    return session
