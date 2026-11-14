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

def test_zero_mad_is_handled_without_division_errors():
    now=datetime.now(timezone.utc)
    rows=[SimpleNamespace(astronaut_id=7,metric="HR",value=v,unit="bpm",quality="good",timestamp=now+timedelta(days=i),id=i) for i,v in enumerate([65,65,65,65,65,82])]
    result=detect(rows)
    assert len(result)==1 and result[0]["baseline"]==65

def test_insufficient_history_does_not_raise_alert():
    now=datetime.now(timezone.utc)
    rows=[SimpleNamespace(astronaut_id=7,metric="HR",value=v,unit="bpm",quality="good",timestamp=now+timedelta(days=i),id=i) for i,v in enumerate([65,65,65,65,82])]
    assert detect(rows)==[]

def test_metric_units_are_compared_separately():
    now=datetime.now(timezone.utc)
    rows=[]
    for i in range(6):
        rows.append(SimpleNamespace(astronaut_id=1,metric="X",value=10 if i < 5 else 1000,unit="bpm",quality="good",timestamp=now+timedelta(days=i),id=i))
        rows.append(SimpleNamespace(astronaut_id=1,metric="X",value=1000,unit="ms",quality="good",timestamp=now+timedelta(days=i),id=i+10))
    found=detect(rows)
    assert len(found)==1 and found[0]["unit"]=="bpm"
