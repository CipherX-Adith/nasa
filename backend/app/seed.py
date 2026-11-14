from datetime import datetime, timedelta, timezone
import math
from .models import Astronaut, Measurement, Assessment, User
from .core import hash_password

def seed(db):
    if db.query(Astronaut).count():
        return
    astronauts = [
        Astronaut(name="Maya Chen", call_sign="ORION-1", mission="Asteria-7", simulated=True),
        Astronaut(name="Elena Rossi", call_sign="VEGA-2", mission="Asteria-7", simulated=True),
        Astronaut(name="David Okafor", call_sign="NOVA-3", mission="Asteria-7", simulated=True),
    ]
    db.add_all(astronauts)
    db.flush()
    now = datetime.now(timezone.utc)

    metrics = [
        ("cardiovascular", "Resting heart rate", "bpm", 65.4),
        ("cardiovascular", "HRV", "ms", 65.0),
        ("cardiovascular", "Systolic BP", "mmHg", 118.0),
        ("immune", "Core Temp", "°C", 36.7),
        ("musculoskeletal", "Grip", "kg", 48.0),
        ("musculoskeletal", "Body mass", "kg", 74.0),
        ("behavioural", "Sleep duration", "hours", 7.5),
        ("behavioural", "Fatigue", "/10", 2.0),
        ("behavioural", "Sleep quality", "/10", 7.5),
        ("behavioural", "Stress", "/10", 2.8),
        ("behavioural", "Mood", "/10", 7.6),
        ("radiation_environment", "Cabin CO2", "mmHg", 2.5),
        ("radiation_environment", "Radiation dose rate", "mSv/day", 0.42),
    ]

    # Pre-calculated 60-day trace for Maya Chen Resting Heart Rate to match the exact curve
    # Calibration window: D1 to D30 (median ~65.4, MAD ~1.8, range [62.73, 68.07])
    # D32: 66.1 bpm (exact tooltip)
    # Drift starts around D38, ascending up to 84 bpm at D60
    maya_hr_curve = {
        1: 65.4, 2: 65.8, 3: 65.1, 4: 66.2, 5: 65.4, 6: 64.9, 7: 65.7, 8: 66.5, 9: 65.0, 10: 64.8,
        11: 65.3, 12: 66.1, 13: 65.5, 14: 64.9, 15: 65.4, 16: 65.9, 17: 64.7, 18: 65.3, 19: 66.4, 20: 65.8,
        21: 65.2, 22: 64.8, 23: 65.6, 24: 66.3, 25: 65.4, 26: 64.7, 27: 65.9, 28: 65.1, 29: 64.2, 30: 63.4,
        31: 64.8, 32: 66.1, 33: 65.5, 34: 66.8, 35: 67.4, 36: 67.9, 37: 68.4, 38: 69.5, 39: 68.8, 40: 69.1,
        41: 69.4, 42: 68.9, 43: 70.1, 44: 70.8, 45: 72.0, 46: 71.4, 47: 71.1, 48: 70.8, 49: 72.3, 50: 73.2,
        51: 71.0, 52: 74.2, 53: 75.4, 54: 76.8, 55: 75.2, 56: 78.1, 57: 76.5, 58: 79.2, 59: 82.5, 60: 84.0
    }

    for ai, a in enumerate(astronauts):
        for domain, metric, unit, base in metrics:
            for day_idx in range(1, 61):
                timestamp = now - timedelta(days=(60 - day_idx))
                
                if metric == "Resting heart rate" and ai == 0:
                    val = maya_hr_curve.get(day_idx, base)
                elif metric == "HRV" and ai == 0:
                    # Normal ~65ms, drops to ~42ms after day 35
                    if day_idx <= 30:
                        val = 65.0 + math.sin(day_idx * 0.7) * 2.5
                    elif day_idx <= 35:
                        val = 63.0 - (day_idx - 30) * 1.2
                    else:
                        val = 55.0 - (day_idx - 35) * 0.55 + math.sin(day_idx) * 2.0
                elif metric == "Systolic BP" and ai == 0:
                    # Normal ~118, drifts up to ~134 after day 35
                    if day_idx <= 30:
                        val = 118.0 + math.cos(day_idx * 0.5) * 2.2
                    elif day_idx <= 35:
                        val = 119.0 + (day_idx - 30) * 0.8
                    else:
                        val = 123.0 + (day_idx - 35) * 0.42 + math.sin(day_idx * 0.8) * 2.0
                elif metric == "Core Temp" and ai == 0:
                    # Normal ~36.7, drifts up to ~37.35 after day 35
                    if day_idx <= 30:
                        val = 36.7 + math.sin(day_idx * 0.6) * 0.12
                    else:
                        val = 36.75 + min((day_idx - 30) * 0.02, 0.6) + math.sin(day_idx) * 0.08
                elif metric == "Grip" and ai == 0:
                    # Normal ~48kg, drops to ~38kg after day 35
                    if day_idx <= 30:
                        val = 48.0 + math.cos(day_idx * 0.6) * 1.5
                    else:
                        val = 48.0 - min((day_idx - 30) * 0.35, 10.0) + math.sin(day_idx) * 1.0
                elif metric == "Sleep duration" and ai == 0:
                    if day_idx <= 35:
                        val = 7.5 + math.sin(day_idx * 0.8) * 0.4
                    else:
                        val = 7.2 - min((day_idx - 35) * 0.1, 2.2) + math.sin(day_idx) * 0.25
                elif metric == "Fatigue" and ai == 0:
                    if day_idx <= 35:
                        val = 2.0 + math.cos(day_idx * 0.5) * 0.5
                    else:
                        val = 2.5 + min((day_idx - 35) * 0.2, 5.0) + math.sin(day_idx) * 0.3
                elif metric == "Sleep quality" and ai == 0:
                    if day_idx <= 35:
                        val = 7.5 + math.cos(day_idx * 0.6) * 0.5
                    else:
                        val = 7.0 - min((day_idx - 35) * 0.18, 4.0) + math.sin(day_idx) * 0.3
                elif metric == "Stress" and ai == 0:
                    if day_idx <= 35:
                        val = 2.8 + math.sin(day_idx * 0.7) * 0.4
                    else:
                        val = 3.0 + min((day_idx - 35) * 0.16, 4.0) + math.cos(day_idx) * 0.3
                elif metric == "Mood" and ai == 0:
                    if day_idx <= 35:
                        val = 7.6 + math.sin(day_idx * 0.5) * 0.4
                    else:
                        val = 7.5 - min((day_idx - 35) * 0.14, 3.2) + math.cos(day_idx) * 0.3
                else:
                    # Generic simulated pattern
                    drift = ((day_idx * 7 + ai * 3) % 7) - 3
                    scale = 0.15 if unit not in ("bpm", "ms", "hours", "/10", "mmHg", "kg") else 1.0
                    val = base + drift * scale
                    if ai == 0 and day_idx > 50:
                        if metric == "Sleep duration":
                            val = 5.0
                        elif metric == "Fatigue":
                            val = 7.0

                db.add(
                    Measurement(
                        astronaut_id=a.id,
                        domain=domain,
                        metric=metric,
                        value=round(val, 2),
                        unit=unit,
                        timestamp=timestamp,
                        source="Simulated mission telemetry",
                        simulated=True,
                    )
                )

        for day_idx in range(1, 61):
            timestamp = now - timedelta(days=(60 - day_idx))
            fatigue = 7 if (ai == 0 and day_idx > 45) else 2 + ((day_idx + ai) % 3)
            sleep_hours = 5.0 if (ai == 0 and day_idx > 45) else 7.5
            db.add(
                Assessment(
                    astronaut_id=a.id,
                    sleep_hours=sleep_hours,
                    sleep_quality=3 if ai == 0 and day_idx > 45 else 7,
                    stress=4 if ai == 0 and day_idx > 45 else 2,
                    mood=6 if ai == 0 and day_idx > 45 else 8,
                    fatigue=fatigue,
                    symptoms="Elevated fatigue and sleep disruption" if (ai == 0 and day_idx > 50) else "No acute symptoms reported",
                    timestamp=timestamp,
                    source="Simulated daily assessment",
                    simulated=True,
                )
            )

    db.add_all([
        User(username="medical", password_hash=hash_password("orbitcare-demo"), role="medical", full_name="Dr. Robert Vance", specialization="Flight Surgeon / Chief Medical Officer"),
        User(username="astronaut", password_hash=hash_password("orbitcare-demo"), role="astronaut", astronaut_id=astronauts[0].id, full_name="Maya Chen", call_sign="ORION-1", specialization="Commander / Mission Specialist"),
        User(username="maya", password_hash=hash_password("orbitcare-demo"), role="astronaut", astronaut_id=astronauts[0].id, full_name="Maya Chen", call_sign="ORION-1", specialization="Commander / Mission Specialist"),
        User(username="elena", password_hash=hash_password("orbitcare-demo"), role="astronaut", astronaut_id=astronauts[1].id, full_name="Elena Rossi", call_sign="VEGA-2", specialization="Flight Engineer / Systems Lead"),
        User(username="david", password_hash=hash_password("orbitcare-demo"), role="astronaut", astronaut_id=astronauts[2].id, full_name="David Okafor", call_sign="NOVA-3", specialization="Science & Payload Specialist"),
    ])
    db.commit()
