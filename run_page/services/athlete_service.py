import os
import yaml
from datetime import datetime
from run_page.config import API_PORT

def get_athlete_metrics():
    """Parses settings.yaml to return athlete metrics, heart rate zones, and analysis factors."""
    config_path = "run_page/settings.yaml"
    
    # Default fallback metrics
    fallback = {
        "max_hr": 190,
        "resting_hr": 60,
        "zones": {
            "zone1": {"from": 95, "to": 114},
            "zone2": {"from": 114, "to": 133},
            "zone3": {"from": 133, "to": 152},
            "zone4": {"from": 152, "to": 171},
            "zone5": {"from": 171, "to": 190}
        },
        "vo2_estimate": 45.0,
        "analysis": {
            "calorie_factors": {"run": 1.036, "ride": 0.5, "default": 0.8},
            "gap_factor": 6.0,
            "gear_warning_threshold": 0.9,
            "training_load": {"ctl_days": 42, "atl_days": 7, "trimp_fallbacks": {"run": 8.0, "ride": 2.0}},
            "tsb_advice": {"peak": 10, "fresh": 0, "optimal": -10, "productive_fatigue": -25},
            "radar_normalization": {
                "endurance_monthly_km": 150, "climb_monthly_m": 1500, "frequency_monthly_sessions": 16, "long_run_km": 25, "speed_pace_min_km": 4.0
            },
            "milestones": {},
            "bins": {},
            "device_mapping": {}
        }
    }

    if not os.path.exists(config_path) or os.path.isdir(config_path):
        return fallback
        
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        if not config: return fallback
    except Exception as e:
        print(f"Error reading YAML: {e}")
        return fallback
    
    athlete = config.get("athlete", {})
    birthday = athlete.get("birthday", "1990-01-01")
    try:
        birth_date = datetime.strptime(birthday, "%Y-%m-%d")
        age = datetime.now().year - birth_date.year
    except:
        age = 30
    
    # 1. Max HR Calculation
    max_hr = athlete.get("max_hr", 0)
    if not max_hr or max_hr == 0:
        formula = athlete.get("max_hr_formula", "fox")
        if formula == "fox": max_hr = 220 - age
        elif formula == "tanaka": max_hr = 208 - (0.7 * age)
        elif formula == "gellish": max_hr = 192 - (0.007 * (age ** 2))
        else: max_hr = 220 - age
            
    # 2. Zone Calculation
    hr_zones = athlete.get("hr_zones", {})
    mode = hr_zones.get("mode", "relative")
    zones_def = hr_zones.get("default", {})
    
    calculated_zones = {}
    for z_name, range_def in zones_def.items():
        if mode == "relative":
            z_from = int(max_hr * (range_def["from"] / 100))
            z_to = int(max_hr * (range_def["to"] / 100)) if range_def.get("to") else None
        else:
            z_from = range_def["from"]
            z_to = range_def["to"]
        calculated_zones[z_name] = {"from": z_from, "to": z_to}
        
    # 3. Physiological Estimates
    resting_hr = athlete.get("resting_hr", 60)
    vo2_hr = 15.3 * (max_hr / resting_hr) if resting_hr > 0 else 45.0
    
    analysis = config.get("analysis", {})
    
    return {
        "gender": athlete.get("gender", "male"),
        "age": age,
        "max_hr": int(max_hr),
        "resting_hr": resting_hr,
        "weight": athlete.get("weight", 70),
        "zones": calculated_zones,
        "vo2_estimate": round(vo2_hr, 1),
        "riegel_exponents": athlete.get("riegel_exponents", {"run": 1.06, "ride": 1.05}),
        "gears": athlete.get("gears", []),
        "annual_distance_target": athlete.get("annual_distance_target", 2000),
        "monthly_elevation_target": athlete.get("monthly_elevation_target", 1000),
        "weekly_frequency_target": athlete.get("weekly_frequency_target", 5),
        "analysis": {
            "calorie_factors": analysis.get("calorie_factors", {"run": 1.036, "ride": 0.5, "default": 0.8}),
            "gap_factor": analysis.get("gap_factor", 6.0),
            "gear_warning_threshold": analysis.get("gear_warning_threshold", 0.9),
            "training_load": analysis.get("training_load", {"ctl_days": 42, "atl_days": 7, "trimp_fallbacks": {"run": 8.0, "ride": 2.0}}),
            "tsb_advice": analysis.get("tsb_advice", {"peak": 10, "fresh": 0, "optimal": -10, "productive_fatigue": -25}),
            "radar_normalization": analysis.get("radar_normalization", {
                "endurance_monthly_km": 150, "climb_monthly_m": 1500, "frequency_monthly_sessions": 16, "long_run_km": 25, "speed_pace_min_km": 4.0
            }),
            "milestones": analysis.get("milestones", {}),
            "bins": analysis.get("bins", {}),
            "device_mapping": analysis.get("device_mapping", {})
        }
    }
