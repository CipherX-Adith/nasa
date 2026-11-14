import statistics
import math
from datetime import datetime, timezone, timedelta
from collections import defaultdict

def baseline(values):
    """Compute robust median and median absolute deviation (MAD) from historical values."""
    clean = [float(v) for v in values if v is not None and math.isfinite(float(v))]
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
        try:
            value = float(row.value)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(value):
            continue
        groups[(row.astronaut_id, row.metric, getattr(row, "unit", ""))].append(row)

    for (aid, metric, unit), rows in groups.items():
        rows.sort(key=lambda x: _time_key(getattr(x, "timestamp", None)))
        if len(rows) < 6:
            continue
        history = rows[:-3] if len(rows) >= 9 else rows[:-1]
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
            out.append({
                "astronaut_id": aid,
                "measurement_id": measurement_id,
                "metric": metric,
                "unit": unit,
                "priority": "high" if z >= 4 else "medium",
                "reason": f"Latest {metric} is {current.value:g} {unit} versus personal historical median {med:g} {unit} (n={b['count']}); " + 
                          ("change has persisted across recent observations." if persistent else f"robust deviation is {z:.1f} scaled units."),
                "value": current.value,
                "baseline": med,
                "timestamp": _time_key(getattr(current, "timestamp", None)).isoformat(),
                "source": getattr(current, "source", "unknown"),
                "simulated": bool(getattr(current, "simulated", False)),
            })
    return out

# -------------------------------------------------------------
# MULTI-DOMAIN ASTRONAUT HEALTH ANALYSIS MODEL
# -------------------------------------------------------------

def analyze_crew_health(measurements, assessments, astronaut=None):
    """Transparent prototype monitoring summary; never a clinical clearance."""
    ordered = sorted(measurements, key=lambda x: _time_key(getattr(x, "timestamp", None)))
    grouped = defaultdict(list)
    for row in ordered:
        if str(getattr(row, "quality", "good") or "good").lower() not in {"poor", "invalid", "unverified"}:
            grouped[(str(row.metric), str(getattr(row, "unit", "")), str(getattr(row, "domain", "other")))].append(row)
    domain_assessments = {}
    abnormal = []
    evidence = []
    missing = []
    for (metric, unit, domain), rows in grouped.items():
        latest = rows[-1]
        historical_rows = rows[:-3] if len(rows) >= 9 else rows[:-1]
        historical = [r for r in historical_rows if not getattr(r, "simulated", False) or getattr(latest, "simulated", False)]
        b = baseline([r.value for r in historical])
        item = {"metric": metric, "value": latest.value, "unit": unit,
                "timestamp": getattr(latest, "timestamp", None).isoformat() if getattr(latest, "timestamp", None) else None,
                "source": getattr(latest, "source", "unknown"), "simulated": bool(getattr(latest, "simulated", False)),
                "baseline": b["median"], "baseline_count": b["count"], "baseline_available": b["available"]}
        evidence.append(item)
        if not b["available"]:
            missing.append(f"{metric}: fewer than 5 historical measurements")
            continue
        scale = max(1.4826 * b["mad"], abs(b["median"]) * .05, .01)
        deviation = abs(float(latest.value) - b["median"]) / scale
        item["deviation_scaled"] = round(deviation, 2)
        if deviation >= 2.5:
            abnormal.append({"category": domain, "severity": "REVIEW" if deviation < 4 else "PRIORITY REVIEW",
                "title": f"{metric} differs from personal baseline", "metric": metric,
                "detail": f"Latest {latest.value:g} {unit} vs historical median {b['median']:g} {unit} (n={b['count']}); illustrative robust deviation {deviation:.1f} scaled units.",
                "current_value": latest.value, "baseline_value": b["median"], "measurement_id": getattr(latest, "id", None),
                "timestamp": item["timestamp"], "source": item["source"], "simulated": item["simulated"]})
        domain_assessments.setdefault(domain, {"title": domain.replace("_", " ").title(), "status": "Recorded observations", "findings": []})
        domain_assessments[domain]["findings"].append(f"{metric}: {latest.value:g} {unit}" + (f"; baseline {b['median']:g} {unit}" if b["available"] else "; baseline unavailable"))
    ordered_assessments = sorted(assessments, key=lambda x: _time_key(getattr(x, "timestamp", None)))
    if ordered_assessments:
        latest = ordered_assessments[-1]
        prev = ordered_assessments[:-1]
        sleep_base = baseline([x.sleep_hours for x in prev])
        fatigue_base = baseline([x.fatigue for x in prev])
        for metric, value, b, unit in (("Self-reported sleep", latest.sleep_hours, sleep_base, "hours"), ("Self-reported fatigue", latest.fatigue, fatigue_base, "/10")):
            if b["available"]:
                evidence.append({"metric": metric, "value": value, "unit": unit, "timestamp": _time_key(getattr(latest,"timestamp",None)).isoformat(), "source": getattr(latest,"source","Astronaut self-report"), "simulated": bool(getattr(latest,"simulated",False)), "baseline": b["median"], "baseline_count": b["count"], "baseline_available": True})
                if abs(value-b["median"]) >= max(2.5*b["mad"], 1.0):
                    abnormal.append({"category":"behavioural", "severity":"REVIEW", "title":f"{metric} differs from prior self-reports", "metric":metric, "detail":f"Latest {value:g} {unit} vs prior median {b['median']:g} {unit} (n={b['count']}); prototype comparison only.", "current_value":value,"baseline_value":b["median"],"timestamp":_time_key(getattr(latest,"timestamp",None)).isoformat(),"source":getattr(latest,"source","Astronaut self-report"),"simulated":bool(getattr(latest,"simulated",False))})
            else: missing.append(f"{metric}: fewer than 5 prior self-reports")
    expected = 8
    coverage = min(100, round(100 * len(evidence) / expected))
    for domain in ("cardiovascular", "musculoskeletal", "immune", "behavioural", "radiation_environment"):
        domain_assessments.setdefault(domain, {"title": domain.replace("_", " ").title(), "status": "No available observations", "findings": ["No recent qualifying observation found."]})
    return {"flight_readiness_score": coverage, "monitoring_coverage": coverage,
        "score_label": "Prototype data coverage", "score_note": "Percent of eight expected sample data points present; not a clinical score or clearance.",
        "overall_status": "REVIEW INDICATED" if abnormal else ("DATA LIMITED" if missing else "NO FLAGGED DEVIATIONS"),
        "domain_assessments": domain_assessments, "abnormal_behaviours": abnormal,
        "recommendations": [], "evidence": evidence, "missing_metrics": missing,
        "calculation": {"available_observation_count":len(evidence), "expected_sample_count":expected, "illustrative_thresholds":True}}

def _time_key(value):
    if value is None: return datetime.min.replace(tzinfo=timezone.utc)
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value

def generate_daily_health_report(astronaut, measurements, assessments, mission_day=42):
    """Build a prototype summary of available records; never medical sign-off."""
    analysis = analyze_crew_health(measurements, assessments, astronaut=astronaut)
    now_utc = datetime.now(timezone.utc)
    astro_name = getattr(astronaut, "name", "Astronaut") if astronaut else "Astronaut"
    call_sign = getattr(astronaut, "call_sign", "CREW-1") if astronaut else "CREW-1"
    aid = getattr(astronaut, "id", 1) if astronaut else 1

    status_label = analysis["overall_status"]
    summary = (f"Prototype monitoring summary for {astro_name} ({call_sign}), Mission Day {mission_day:03d}: "
               f"{len(analysis['evidence'])} recorded data points reviewed; {len(analysis['abnormal_behaviours'])} illustrative baseline deviations flagged. "
               "This summary is not clinically validated and does not determine flight clearance.")

    return {
        "report_id": f"CSR-2026-D{mission_day:03d}-A{aid}",
        "mission_day": mission_day,
        "generated_at": now_utc.isoformat(),
        "date_str": now_utc.strftime("%B %d, %Y · %H:%M UTC"),
        "astronaut_id": aid,
        "astronaut_name": astro_name,
        "call_sign": call_sign,
        "mission": getattr(astronaut, "mission", "Mars Transit") if astronaut else "Mars Transit",
        "flight_readiness_score": analysis["monitoring_coverage"],
        "monitoring_coverage": analysis["monitoring_coverage"],
        "score_label": analysis["score_label"],
        "score_note": analysis["score_note"],
        "evidence": analysis["evidence"],
        "missing_metrics": analysis["missing_metrics"],
        "calculation": analysis["calculation"],
        "overall_status": status_label,
        "executive_summary": summary,
        "domain_assessments": analysis["domain_assessments"],
        "abnormal_behaviours": analysis["abnormal_behaviours"],
        "countermeasures": [],
        "physician": None,
        "physician_title": None,
        "verified": False,
        "simulated": bool(getattr(astronaut, "simulated", False)),
        "status": "Generated data summary · pending clinician review"
    }

def generate_hourly_telemetry(aid: int, metric: str = "Resting heart rate", day: int = 42):
    """Return a clearly labeled illustrative profile for the demo chart only."""
    now_utc = datetime.now(timezone.utc)
    current_hour = now_utc.hour

    # Baseline profiles
    # These values are illustrative chart points; they are not readouts or alerts.
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
        "simulated": True,
        "source": "Illustrative generated profile; not stored telemetry",
        "current_hour": current_hour,
        "current_value": points[current_hour]["value"],
        "hourly_points": points
    }
