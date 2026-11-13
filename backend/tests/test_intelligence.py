from types import SimpleNamespace
from datetime import datetime, timezone, timedelta
from app.intelligence import baseline, detect

def test_baseline_insufficient_history():
    assert baseline([1,2,3,4])["available"] is False
def test_baseline_robust_median():
    b=baseline([10,11,10,9,10,100]);assert b["available"] and b["median"]==10
def test_detect_flags_large_personal_deviation():
    now=datetime.now(timezone.utc)
    rows=[SimpleNamespace(astronaut_id=1,metric="HR",value=v,unit="bpm",quality="good",timestamp=now+timedelta(days=i),id=i) for i,v in enumerate([65,65,66,64,65,82])]
    found=detect(rows);assert found and found[0]["priority"]=="high"
def test_quality_excluded():
    now=datetime.now(timezone.utc);rows=[SimpleNamespace(astronaut_id=1,metric="X",value=10,unit="u",quality="poor",timestamp=now+timedelta(days=i),id=i) for i in range(8)]
    assert detect(rows)==[]
