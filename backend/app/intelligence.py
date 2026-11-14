import statistics
from collections import defaultdict

def baseline(values):
    clean = [float(v) for v in values if v is not None]
    if len(clean) < 5:
        return {"available": False, "count": len(clean), "reason": "At least 5 historical observations are needed.", "median": None, "mad": None, "period": "Available history"}
    med = float(statistics.median(clean))
    mad = float(statistics.median([abs(x - med) for x in clean]))
    return {"available": True, "count": len(clean), "median": round(med, 2), "mad": round(mad, 2), "period": "Available historical observations"}

def detect(values):
    """Flag robust personal-baseline deviation or repeated directional movement."""
    out=[]
    groups=defaultdict(list)
    for row in values:
        if row.quality.lower() in ("poor","invalid","unverified"): continue
        groups[(row.astronaut_id,row.metric)].append(row)
    for (_,metric),rows in groups.items():
        rows.sort(key=lambda x:x.timestamp)
        if len(rows)<6: continue
        history=rows[:-1]; current=rows[-1]; b=baseline([x.value for x in history])
        if not b["available"]: continue
        med=b["median"]; mad=b["mad"]; scale=max(1.4826*mad,abs(med)*.05,0.01)
        z=abs(current.value-med)/scale
        recent=rows[-3:]
        persistent=all((x.value-med)*(recent[-1].value-med)>0 for x in recent) and abs(recent[-1].value-med)>abs(recent[0].value-med)
        if z>=2.5 or persistent:
            out.append({"astronaut_id":current.astronaut_id,"measurement_id":current.id,"metric":metric,"priority":"high" if z>=4 else "medium","reason":f"Latest {metric} is {current.value:g} {current.unit} versus personal historical median {med:g} {current.unit} (n={b['count']}); "+("change has persisted across recent observations." if persistent else f"robust deviation is {z:.1f} scaled units."),"value":current.value,"baseline":med})
    return out
