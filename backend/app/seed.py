from datetime import datetime, timedelta, timezone
import math
from .models import Astronaut, Measurement, Assessment, User, MedicalDocument, MedicalObservation
from .core import hash_password

def seed(db):
    if db.query(Astronaut).count():
        return
    astronauts = [
        Astronaut(name="Maya Chen", call_sign="ORION-1", mission="Mars Transit", simulated=True),
        Astronaut(name="Elena Rossi", call_sign="VEGA-2", mission="Mars Transit", simulated=True),
        Astronaut(name="David Okafor", call_sign="NOVA-3", mission="Mars Transit", simulated=True),
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

    # Explicitly simulated Mars Transit — Day 42 demo. Days 1–39 provide
    # illustrative baselines; the final values match the project brief.
    maya_hr_curve = {
        1: 65.4, 2: 65.8, 3: 65.1, 4: 66.2, 5: 65.4, 6: 64.9, 7: 65.7, 8: 66.5, 9: 65.0, 10: 64.8,
        11: 65.3, 12: 66.1, 13: 65.5, 14: 64.9, 15: 65.4, 16: 65.9, 17: 64.7, 18: 65.3, 19: 66.4, 20: 65.8,
        21: 65.2, 22: 64.8, 23: 65.6, 24: 66.3, 25: 65.4, 26: 64.7, 27: 65.9, 28: 65.1, 29: 64.2, 30: 63.4,
        31: 64.8, 32: 66.1, 33: 65.5, 34: 66.8, 35: 67.4, 36: 67.9, 37: 68.4, 38: 69.5, 39: 68.8, 40: 69.1,
        41: 69.4, 42: 68.9, 43: 70.1, 44: 70.8, 45: 72.0, 46: 71.4, 47: 71.1, 48: 70.8, 49: 72.3, 50: 73.2,
        40: 76.0, 41: 79.0, 42: 82.0
    }

    for ai, a in enumerate(astronauts):
        for domain, metric, unit, base in metrics:
            for day_idx in range(1, 43):
                timestamp = now - timedelta(days=(42 - day_idx))
                
                if metric == "Resting heart rate" and ai == 0:
                    val = (65.0 if day_idx % 2 else (64.5 if day_idx % 4 == 0 else 65.5)) if day_idx <= 39 else maya_hr_curve[day_idx]
                elif metric == "HRV" and ai == 0:
                    if day_idx <= 39:
                        val = 65.0 + math.sin(day_idx * 0.7) * 2.5
                    elif day_idx == 40:
                        val = 53.0
                    elif day_idx == 41:
                        val = 47.0
                    else:
                        val = 42.0
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
                    if day_idx <= 39:
                        val = 7.5 + math.sin(day_idx * 0.8) * 0.4
                    else: val = {40: 6.0, 41: 5.5, 42: 5.0}[day_idx]
                elif metric == "Fatigue" and ai == 0:
                    if day_idx <= 39:
                        val = 2.0 + math.cos(day_idx * 0.5) * 0.5
                    else: val = {40: 5.0, 41: 6.0, 42: 7.0}[day_idx]
                elif metric == "Sleep quality" and ai == 0:
                    if day_idx <= 39:
                        val = 7.5 + math.cos(day_idx * 0.6) * 0.5
                    elif day_idx <= 39:
                        val = 7.0 - min((day_idx - 35) * 0.18, 4.0) + math.sin(day_idx) * 0.3
                    else: val = 3.0
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

        for day_idx in range(1, 43):
            timestamp = now - timedelta(days=(42 - day_idx))
            fatigue = (7 if day_idx == 42 else 6 if day_idx == 41 else 5 if day_idx == 40 else 2) if ai == 0 else 2 + ((day_idx + ai) % 3)
            sleep_hours = ({40: 6.0, 41: 5.5, 42: 5.0}.get(day_idx, 7.5)) if ai == 0 else 7.5
            db.add(
                Assessment(
                    astronaut_id=a.id,
                    sleep_hours=sleep_hours,
                    sleep_quality=3 if ai == 0 and day_idx >= 40 else 7,
                    stress=4 if ai == 0 and day_idx >= 40 else 2,
                    mood=6 if ai == 0 and day_idx >= 40 else 8,
                    fatigue=fatigue,
                    symptoms="Self-reported fatigue and sleep disruption" if (ai == 0 and day_idx >= 40) else "No symptoms reported",
                    timestamp=timestamp,
                    source="Simulated daily assessment",
                    simulated=True,
                )
            )

    demo_doc = MedicalDocument(
        astronaut_id=astronauts[0].id,
        filename="SIMULATED_DAY42_REVIEW_SAMPLE.txt",
        report_date="Mission Day 42",
        extracted_text="SIMULATED TRAINING SAMPLE. No real patient or flight data. Self-reported fatigue and sleep disruption noted for review.",
        confidence=0.35,
        extraction_method="seeded_demo_text",
        simulated=True,
    )
    db.add(demo_doc)
    db.flush()
    db.add(MedicalObservation(
        document_id=demo_doc.id,
        test_name="Training sample note",
        result="Sleep disruption reported",
        unit="",
        reference_range="Not provided",
        report_date="Mission Day 42",
        confidence=0.35,
        review_status="pending_review",
    ))

    db.add_all([
        User(username="medical", password_hash=hash_password("orbitcare-demo"), role="medical", full_name="Dr. Robert Vance", specialization="Flight Surgeon / Chief Medical Officer"),
        User(username="astronaut", password_hash=hash_password("orbitcare-demo"), role="astronaut", astronaut_id=astronauts[0].id, full_name="Maya Chen", call_sign="ORION-1", specialization="Commander / Mission Specialist"),
        User(username="maya", password_hash=hash_password("orbitcare-demo"), role="astronaut", astronaut_id=astronauts[0].id, full_name="Maya Chen", call_sign="ORION-1", specialization="Commander / Mission Specialist"),
        User(username="elena", password_hash=hash_password("orbitcare-demo"), role="astronaut", astronaut_id=astronauts[1].id, full_name="Elena Rossi", call_sign="VEGA-2", specialization="Flight Engineer / Systems Lead"),
        User(username="david", password_hash=hash_password("orbitcare-demo"), role="astronaut", astronaut_id=astronauts[2].id, full_name="David Okafor", call_sign="NOVA-3", specialization="Science & Payload Specialist"),
    ])
    db.commit()
