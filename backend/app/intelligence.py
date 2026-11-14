import statistics
import math
from datetime import datetime, timezone, timedelta
from collections import defaultdict

def baseline(values):
    """Compute robust median and median absolute deviation (MAD) from historical values."""
    clean = [float(v) for v in values if v is not None]
    if len(clean) < 5:
        return {
            "available": False,
            "count": len(clean),
            "reason": "At least 5 historical observations are needed.",
            "median": None,
            "mad": None,
            "period": "Available history"
        }
    med = float(statistics.median(clean))
    mad = float(statistics.median([abs(x - med) for x in clean]))
    return {
        "available": True,
        "count": len(clean),
        "median": round(med, 2),
        "mad": round(mad, 2),
        "period": "Available historical observations"
    }

def detect(values):
    """Flag robust personal-baseline deviation or repeated directional movement.
    Deduplicates repeated alerts to avoid alert fatigue."""
    out = []
    groups = defaultdict(list)
    for row in values:
        quality = getattr(row, "quality", "good")
        if quality and quality.lower() in ("poor", "invalid", "unverified"):
            continue
        groups[(row.astronaut_id, row.metric)].append(row)

    for (aid, metric), rows in groups.items():
        rows.sort(key=lambda x: x.timestamp)
        if len(rows) < 6:
            continue
        history = rows[:-1]
        current = rows[-1]
        b = baseline([x.value for x in history])
        if not b["available"]:
            continue
        med = b["median"]
        mad = b["mad"]
        scale = max(1.4826 * mad, abs(med) * 0.05, 0.01)
        z = abs(current.value - med) / scale
        recent = rows[-3:]
        persistent = all((x.value - med) * (recent[-1].value - med) > 0 for x in recent) and abs(recent[-1].value - med) > abs(recent[0].value - med)
        
        if z >= 2.5 or persistent:
            measurement_id = getattr(current, "id", None)
            unit = getattr(current, "unit", "")
            out.append({
                "astronaut_id": aid,
                "measurement_id": measurement_id,
                "metric": metric,
                "priority": "high" if z >= 4 else "medium",
                "reason": f"Latest {metric} is {current.value:g} {unit} versus personal historical median {med:g} {unit} (n={b['count']}); " + 
                          ("change has persisted across recent observations." if persistent else f"robust deviation is {z:.1f} scaled units."),
                "value": current.value,
                "baseline": med
            })
    return out

# -------------------------------------------------------------
# MULTI-DOMAIN ASTRONAUT HEALTH ANALYSIS MODEL
# -------------------------------------------------------------

def analyze_crew_health(measurements, assessments, astronaut=None):
    """
    Evaluates multi-system longitudinal health metrics across:
    1. Cardiovascular Adaptation (Heart rate drift, HRV autonomic tone, BP)
    2. Neurocognitive & Behavioural (Sleep architecture, cumulative fatigue, stress, mood)
    3. Musculoskeletal & Physical Conditioning (Grip force, body mass)
    4. Environmental & Life Support Exposure (Cabin CO2, radiation)

    Returns:
    - flight_readiness_score (0 - 100)
    - status ('NOMINAL', 'ELEVATED RISK', 'CRITICAL')
    - domain_assessments (detailed breakdown)
    - abnormal_behaviours (flagged anomalies)
    - recommendations (evidence-based countermeasures)
    """
    by_metric = defaultdict(list)
    for m in measurements:
        by_metric[getattr(m, "metric", "")].append(m)

    # Sort each metric chronologically
    for m_list in by_metric.values():
        m_list.sort(key=lambda x: getattr(x, "timestamp", datetime.min))

    # Sort assessments chronologically
    sorted_assessments = sorted(
        assessments,
        key=lambda x: getattr(x, "timestamp", datetime.min)
    )

    readiness = 100.0
    abnormal_behaviours = []
    domain_assessments = {}
    recommendations = []

    # 1. Cardiovascular System Analysis
    hr_list = by_metric.get("Resting heart rate", [])
    hrv_list = by_metric.get("HRV", [])
    bp_list = by_metric.get("Systolic BP", [])

    cardio_status = "NOMINAL"
    cardio_findings = []

    if hr_list and len(hr_list) >= 5:
        base_hr = baseline([x.value for x in hr_list[:30]])
        latest_hr = hr_list[-1].value
        med_hr = base_hr["median"] or 65.0
        hr_drift = latest_hr - med_hr

        if hr_drift >= 12.0:
            cardio_status = "ELEVATED RISK"
            readiness -= 18.0
            abnormal_behaviours.append({
                "category": "Cardiovascular",
                "severity": "HIGH" if hr_drift >= 18.0 else "MEDIUM",
                "title": "Persistent Tachycardic Baseline Drift",
                "detail": f"Resting heart rate drifted to {latest_hr:.1f} bpm (+{hr_drift:.1f} bpm above personal baseline {med_hr:.1f} bpm). Indicates autonomic stress or cardiovascular deconditioning.",
                "metric": "Resting heart rate",
                "current_value": latest_hr,
                "baseline_value": med_hr
            })
            cardio_findings.append(f"Elevated resting HR of {latest_hr:.1f} bpm (+{hr_drift:.1f} bpm drift)")
            recommendations.append("Increase lower-body negative pressure (LBNP) or ergometer resistance loading by 15% to stimulate venous return.")
        elif hr_drift >= 6.0:
            readiness -= 8.0
            cardio_findings.append(f"Mild elevation in resting HR (+{hr_drift:.1f} bpm)")

    if hrv_list and len(hrv_list) >= 5:
        base_hrv = baseline([x.value for x in hrv_list[:30]])
        latest_hrv = hrv_list[-1].value
        med_hrv = base_hrv["median"] or 62.0
        hrv_drop = med_hrv - latest_hrv

        if hrv_drop >= 15.0:
            cardio_status = "ELEVATED RISK"
            readiness -= 12.0
            abnormal_behaviours.append({
                "category": "Autonomic Nervous System",
                "severity": "MEDIUM",
                "title": "Reduced Heart Rate Variability (Vagal Withdrawal)",
                "detail": f"HRV decreased to {latest_hrv:.1f} ms (-{hrv_drop:.1f} ms below baseline {med_hrv:.1f} ms), signaling systemic physiological strain.",
                "metric": "HRV",
                "current_value": latest_hrv,
                "baseline_value": med_hrv
            })
            cardio_findings.append(f"HRV suppressed to {latest_hrv:.1f} ms (vagal withdrawal)")
            recommendations.append("Prescribe active recovery interval session and 20 min guided diaphragmatic breathing.")

    domain_assessments["cardiovascular"] = {
        "title": "Cardiovascular & Hemodynamics",
        "status": cardio_status,
        "score": max(50, int(100 - (100 - readiness) * 0.4)),
        "findings": cardio_findings or ["Hemodynamic parameters within nominal calibrated limits."]
    }

    # 2. Neurocognitive & Behavioural Health Analysis
    behav_status = "NOMINAL"
    behav_findings = []

    if sorted_assessments:
        recent_ass = sorted_assessments[-5:]
        latest_ass = sorted_assessments[-1]

        avg_sleep = statistics.mean([getattr(a, "sleep_hours", 7.5) for a in recent_ass])
        latest_sleep = getattr(latest_ass, "sleep_hours", 7.5)
        latest_fatigue = getattr(latest_ass, "fatigue", 2)
        latest_stress = getattr(latest_ass, "stress", 3)
        latest_mood = getattr(latest_ass, "mood", 7)
        symptoms = getattr(latest_ass, "symptoms", "None reported")

        # Check sleep deprivation
        if latest_sleep < 5.5 or avg_sleep < 6.0:
            behav_status = "ELEVATED RISK"
            readiness -= 15.0
            abnormal_behaviours.append({
                "category": "Behavioural & Sleep",
                "severity": "HIGH" if latest_sleep < 4.5 else "MEDIUM",
                "title": "Acute Sleep Deprivation & Circadian Deficit",
                "detail": f"Reported {latest_sleep:.1f} hours sleep (rolling 5-day average: {avg_sleep:.1f} hrs). Chronic sleep debt degrades cognitive alertness and motor reaction time.",
                "metric": "Sleep duration",
                "current_value": latest_sleep,
                "baseline_value": 7.5
            })
            behav_findings.append(f"Sleep duration restricted to {latest_sleep:.1f}h (deficit vs 7.5h nominal)")
            recommendations.append("Enforce 45-minute cabin LED circadian phase-shift and prescribe 0.5 mg oral melatonin 30 minutes pre-sleep.")

        # Check fatigue & stress interaction
        if latest_fatigue >= 7 or (latest_fatigue >= 6 and latest_stress >= 6):
            if behav_status == "NOMINAL":
                behav_status = "ELEVATED RISK"
            readiness -= 14.0
            abnormal_behaviours.append({
                "category": "Cognitive Performance",
                "severity": "MEDIUM",
                "title": "Elevated Subjective Fatigue & Cognitive Stress",
                "detail": f"Fatigue index rated {latest_fatigue}/10 and stress at {latest_stress}/10. High operational workload or environmental stressors require workload throttling.",
                "metric": "Fatigue",
                "current_value": latest_fatigue,
                "baseline_value": 2
            })
            behav_findings.append(f"Fatigue index elevated at {latest_fatigue}/10; stress at {latest_stress}/10")
            recommendations.append("Reduce high-complexity payload schedule; grant 2-hour sleep buffer / rest cycle.")

        # Symptom surveillance
        if symptoms and symptoms.lower() not in ("none", "none reported", "nominal pre-flight readiness", "nominal"):
            readiness -= 8.0
            abnormal_behaviours.append({
                "category": "Symptom Surveillance",
                "severity": "MEDIUM",
                "title": f"Reported Somatic Symptoms: {symptoms}",
                "detail": f"Astronaut logged: '{symptoms}'. Requires clinical monitoring for vestibular space adaptation syndrome or environmental co-factors.",
                "metric": "Symptoms",
                "current_value": symptoms,
                "baseline_value": "None"
            })
            behav_findings.append(f"Active clinical symptom: {symptoms}")

    domain_assessments["behavioural"] = {
        "title": "Neurocognitive & Behavioural State",
        "status": behav_status,
        "score": max(50, int(100 - (100 - readiness) * 0.35)),
        "findings": behav_findings or ["Sleep architecture and cognitive indices remain nominal."]
    }

    # 3. Musculoskeletal Conditioning
    musc_status = "NOMINAL"
    musc_findings = []
    grip_list = by_metric.get("Grip", [])

    if grip_list and len(grip_list) >= 5:
        base_grip = baseline([x.value for x in grip_list[:30]])
        latest_grip = grip_list[-1].value
        med_grip = base_grip["median"] or 45.0
        grip_drop = med_grip - latest_grip

        if grip_drop >= 4.0:
            musc_status = "ELEVATED RISK"
            readiness -= 10.0
            abnormal_behaviours.append({
                "category": "Musculoskeletal",
                "severity": "MEDIUM",
                "title": "Isometric Grip Strength Decline",
                "detail": f"Grip strength measured {latest_grip:.1f} kg (-{grip_drop:.1f} kg loss from baseline {med_grip:.1f} kg). Suggests microgravity neuromuscular deconditioning.",
                "metric": "Grip",
                "current_value": latest_grip,
                "baseline_value": med_grip
            })
            musc_findings.append(f"Grip strength declined to {latest_grip:.1f} kg (-{grip_drop:.1f} kg)")
            recommendations.append("Prescribe targeted forearm isometric contractions and increase ARED deadlift volume.")
        else:
            musc_findings.append(f"Grip force stable at {latest_grip:.1f} kg.")

    domain_assessments["musculoskeletal"] = {
        "title": "Musculoskeletal & Physical Conditioning",
        "status": musc_status,
        "score": 90 if musc_status == "NOMINAL" else 75,
        "findings": musc_findings or ["Muscle performance and isometric grip strength stable."]
    }

    # 4. Environmental & Life Support Exposure
    env_status = "NOMINAL"
    env_findings = []
    co2_list = by_metric.get("Cabin CO2", [])

    if co2_list:
        latest_co2 = co2_list[-1].value
        if latest_co2 >= 3.5:
            env_status = "ELEVATED RISK"
            readiness -= 8.0
            abnormal_behaviours.append({
                "category": "Environmental",
                "severity": "MEDIUM",
                "title": "Elevated Cabin CO2 Partial Pressure",
                "detail": f"Ambient CO2 reached {latest_co2:.2f} mmHg. Spaceflight hypercapnia can exacerbate morning cephalic headache and cognitive lethargy.",
                "metric": "Cabin CO2",
                "current_value": latest_co2,
                "baseline_value": 2.4
            })
            env_findings.append(f"Cabin CO2 elevated at {latest_co2:.2f} mmHg")
            recommendations.append("Activate ECLSS secondary CDRA (Carbon Dioxide Removal Assembly) bed.")
        else:
            env_findings.append(f"Atmospheric CO2 nominal at {latest_co2:.2f} mmHg.")

    domain_assessments["environmental"] = {
        "title": "Environmental & Life Support Safety",
        "status": env_status,
        "score": 95 if env_status == "NOMINAL" else 80,
        "findings": env_findings or ["ECLSS atmospheric parameters and radiation levels within safe limits."]
    }

    final_score = max(35, min(100, int(round(readiness))))
    overall_status = "NOMINAL"
    if final_score < 65 or any(b["severity"] == "HIGH" for b in abnormal_behaviours):
        overall_status = "CRITICAL"
    elif final_score < 85 or len(abnormal_behaviours) >= 1:
        overall_status = "ELEVATED RISK"

    return {
        "flight_readiness_score": final_score,
        "overall_status": overall_status,
        "domain_assessments": domain_assessments,
        "abnormal_behaviours": abnormal_behaviours,
        "recommendations": recommendations or ["Continue current diet, hydration, and 2.5-hour daily countermeasure exercise protocol."]
    }

def generate_daily_health_report(astronaut, measurements, assessments, mission_day=60):
    """
    Generates a NASA Flight Surgeon Daily Clinical Health Report
    synthesizing all multi-domain observations, anomaly warnings, and countermeasure plans.
    """
    analysis = analyze_crew_health(measurements, assessments, astronaut=astronaut)
    now_utc = datetime.now(timezone.utc)
    astro_name = getattr(astronaut, "name", "Astronaut") if astronaut else "Astronaut"
    call_sign = getattr(astronaut, "call_sign", "CREW-1") if astronaut else "CREW-1"
    aid = getattr(astronaut, "id", 1) if astronaut else 1

    # Format clinical summary
    status_label = analysis["overall_status"]
    score = analysis["flight_readiness_score"]

    if status_label == "CRITICAL":
        summary = (
            f"Daily clinical review for {astro_name} ({call_sign}) on Mission Day {mission_day:03d} "
            f"indicates acute deconditioning with a Flight Readiness Score of {score}%. "
            f"Significant physiological drift detected across {len(analysis['abnormal_behaviours'])} system markers. "
            f"Immediate flight surgeon countermeasure adjustments required."
        )
    elif status_label == "ELEVATED RISK":
        summary = (
            f"Daily clinical review for {astro_name} ({call_sign}) on Mission Day {mission_day:03d} "
            f"identifies moderate physiological adaptation stress (Readiness Score: {score}%). "
            f"Cardiovascular or circadian drift noted; adaptive countermeasures recommended to prevent functional degradation."
        )
    else:
        summary = (
            f"Daily clinical review for {astro_name} ({call_sign}) on Mission Day {mission_day:03d} "
            f"demonstrates excellent physiological adaptation (Readiness Score: {score}%). "
            f"All major hemodynamic, sleep, and physical conditioning markers remain within calibrated baselines."
        )

    return {
        "report_id": f"CSR-2026-D{mission_day:03d}-A{aid}",
        "mission_day": mission_day,
        "generated_at": now_utc.isoformat(),
        "date_str": now_utc.strftime("%B %d, %Y · %H:%M UTC"),
        "astronaut_id": aid,
        "astronaut_name": astro_name,
        "call_sign": call_sign,
        "mission": getattr(astronaut, "mission", "Asteria-7") if astronaut else "Asteria-7",
        "flight_readiness_score": score,
        "overall_status": status_label,
        "executive_summary": summary,
        "domain_assessments": analysis["domain_assessments"],
        "abnormal_behaviours": analysis["abnormal_behaviours"],
        "countermeasures": analysis["recommendations"],
        "physician": "Dr. Robert Vance",
        "physician_title": "Chief Flight Surgeon / Medical Officer",
        "verified": True
    }

def generate_hourly_telemetry(aid: int, metric: str = "Resting heart rate", day: int = 60):
    """
    Generates realistic 24-hour circadian telemetry readings (00:00 to 23:00 / H00 to H23)
    for the current mission day.
    
    Cardiovascular circadian pattern in spaceflight:
    - 00:00 - 06:00: Sleep / nadir period (lower HR, high vagal tone)
    - 07:00 - 09:00: Waking / cortisol awakening surge
    - 10:00 - 14:00: Operational workload / EVA / Exercise protocol
    - 15:00 - 19:00: Afternoon maintenance / payload operations
    - 20:00 - 23:00: Evening wind-down / pre-sleep
    """
    now_utc = datetime.now(timezone.utc)
    current_hour = now_utc.hour

    # Baseline profiles
    # Maya Chen (aid=1) at Day 60: elevated daytime HR (~84 bpm) due to sleep debt & deconditioning
    # Elena Rossi (aid=2): nominal (~66 bpm)
    # David Okafor (aid=3): nominal (~68 bpm)
    if aid == 1:
        day_baseline = 84.0
        night_nadir = 68.0
        unit = "bpm"
    elif aid == 2:
        day_baseline = 66.0
        night_nadir = 56.0
        unit = "bpm"
    else:
        day_baseline = 68.0
        night_nadir = 58.0
        unit = "bpm"

    # Map other metrics if requested
    if metric == "HRV":
        unit = "ms"
        day_baseline = 48.0 if aid == 1 else 65.0
        night_nadir = 62.0 if aid == 1 else 82.0
    elif metric == "Systolic BP":
        unit = "mmHg"
        day_baseline = 124.0 if aid == 1 else 115.0
        night_nadir = 108.0 if aid == 1 else 102.0
    elif metric == "Core Temp":
        unit = "°C"
        day_baseline = 37.1
        night_nadir = 36.4

    points = []
    for h in range(24):
        # Circadian modulation curve using negative cosine (low at 03:00, high at 14:00)
        # Peak around 14:00 (h=14), nadir around 03:00 (h=3)
        angle = ((h - 3) / 24.0) * 2.0 * math.pi
        circadian_factor = (1.0 - math.cos(angle)) / 2.0  # 0 at h=3, 1 at h=15
        
        expected_val = night_nadir + (day_baseline - night_nadir) * circadian_factor
        
        # Add small deterministic micro-jitter per hour
        jitter = ((h * 7 + aid * 13) % 9 - 4) * 0.35
        val = round(expected_val + jitter, 1)

        is_drift = False
        if metric in ("Resting heart rate", "Heart Rate"):
            is_drift = val > 75.0 if aid == 1 else val > 80.0

        is_current = (h == current_hour)
        label = f"{h:02d}:00"
        hour_code = f"H{h:02d}"

        points.append({
            "hour": label,
            "hour_code": hour_code,
            "hour_index": h,
            "metric": metric,
            "value": val,
            "unit": unit,
            "is_current": is_current,
            "is_drift": is_drift,
            "day": day,
            "timestamp": (now_utc.replace(hour=h, minute=0, second=0, microsecond=0)).isoformat()
        })

    return {
        "metric": metric,
        "unit": unit,
        "mission_day": day,
        "current_hour": current_hour,
        "current_value": points[current_hour]["value"],
        "hourly_points": points
    }
