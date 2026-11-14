from fastapi.testclient import TestClient
from app.main import app

client=TestClient(app)

def token(username):
    response=client.post("/api/auth/login",json={"username":username,"password":"orbitcare-demo"})
    assert response.status_code==200
    return response.json()["access_token"]

def test_demo_authentication_and_seeded_profiles():
    medical=token("medical")
    astronauts=client.get("/api/astronauts",headers={"Authorization":f"Bearer {medical}"})
    assert astronauts.status_code==200 and len(astronauts.json())>=3

def test_astronaut_access_is_limited_to_own_profile():
    astronaut=token("astronaut")
    response=client.get("/api/astronauts",headers={"Authorization":f"Bearer {astronaut}"})
    assert response.status_code==200 and len(response.json())==1
    other=client.get("/api/astronauts/2/measurements",headers={"Authorization":f"Bearer {astronaut}"})
    assert other.status_code==403

def test_assistant_uses_seeded_records_without_gemini(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY",raising=False)
    astronaut=token("maya")
    headers={"Authorization":f"Bearer {astronaut}"}
    status=client.get("/api/assistant/status",headers=headers)
    assert status.status_code==200 and status.json()["mode"]=="LOCAL FALLBACK MODE"
    response=client.post("/api/assistant/ask",headers=headers,json={"question":"Summarize recent health changes"})
    assert response.status_code==200
    payload=response.json()
    assert payload["mode"]=="Local evidence mode"
    assert "Resting heart rate" in payload["answer"]
    assert payload["sources"]

def test_assistant_answers_alert_questions_with_alert_records(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY",raising=False)
    astronaut=token("maya")
    response=client.post("/api/assistant/ask",headers={"Authorization":f"Bearer {astronaut}"},json={"question":"What evidence supports the open alerts?"})
    assert response.status_code==200
    assert "Open alerts:" in response.json()["answer"]

def test_assistant_uses_configured_gemini_through_backend(monkeypatch):
    import httpx
    monkeypatch.setenv("GEMINI_API_KEY","server-side-test-key")
    monkeypatch.setenv("GEMINI_MODEL","gemini-3.8-flash")
    astronaut=token("maya")
    calls={}
    class FakeResponse:
        status_code=200
        def json(self):
            return {"candidates":[{"content":{"parts":[{"text":"The latest record is [M1]."}]}}]}
    def fake_post(url,headers,json,timeout):
        calls.update(url=url,headers=headers,json=json,timeout=timeout)
        return FakeResponse()
    monkeypatch.setattr(httpx,"post",fake_post)
    response=client.post("/api/assistant/ask",headers={"Authorization":f"Bearer {astronaut}"},json={"question":"Summarize recent changes"})
    assert response.status_code==200
    assert response.json()["mode"]=="Gemini · gemini-3.8-flash"
    assert response.json()["answer"]=="The latest record is [M1]."
    assert calls["headers"]["x-goog-api-key"]=="server-side-test-key"
    assert "server-side-test-key" not in calls["url"]

def test_hourly_telemetry_and_clinical_reports():
    medical=token("medical")
    # 1. Test hourly telemetry
    hourly=client.get("/api/astronauts/1/telemetry/hourly?metric=Resting%20heart%20rate",headers={"Authorization":f"Bearer {medical}"})
    assert hourly.status_code==200
    h_data=hourly.json()
    assert len(h_data["hourly_points"])==24
    assert "current_hour" in h_data

    # 2. Test daily clinical health report
    report=client.get("/api/astronauts/1/reports/daily?day=60",headers={"Authorization":f"Bearer {medical}"})
    assert report.status_code==200
    r_data=report.json()
    assert r_data["flight_readiness_score"] > 0
    assert "overall_status" in r_data
    assert "executive_summary" in r_data
    assert "abnormal_behaviours" in r_data

    # 3. Test abnormal behaviour warnings
    warnings=client.get("/api/astronauts/1/warnings",headers={"Authorization":f"Bearer {medical}"})
    assert warnings.status_code==200
    w_data=warnings.json()
    assert "abnormal_behaviours" in w_data
    assert "flight_readiness_score" in w_data

def test_fake_client_token_is_rejected():
    response=client.get("/api/auth/me",headers={"Authorization":"Bearer demo-token-maya"})
    assert response.status_code==401

def test_mars_transit_day42_seed_has_requested_illustrative_values_and_sources():
    medical=token("medical"); headers={"Authorization":f"Bearer {medical}"}
    astronauts=client.get("/api/astronauts",headers=headers).json()
    assert len(astronauts)==3 and all(a["mission"]=="Mars Transit" and a["simulated"] for a in astronauts)
    measurements=client.get("/api/astronauts/1/measurements",headers=headers).json()
    latest={}
    for row in measurements: latest[row["metric"]]=row
    assert latest["Resting heart rate"]["value"]==82 and latest["Resting heart rate"]["simulated"] is True
    assert latest["HRV"]["value"]==42
    assert latest["Sleep duration"]["value"]==5
    assert latest["Fatigue"]["value"]==7
    baseline_rows=client.get("/api/astronauts/1/baselines",headers=headers).json()
    hr=next(x for x in baseline_rows if x["metric"]=="Resting heart rate")
    assert hr["median"]==65.0
    alerts=client.get("/api/alerts?astronaut_id=1",headers=headers)
    assert alerts.status_code==200 and any("Resting heart rate"==x["metric"] for x in alerts.json())
    repeated=client.get("/api/alerts?astronaut_id=1",headers=headers)
    assert [x["id"] for x in repeated.json()]==[x["id"] for x in alerts.json()]

def test_only_astronaut_self_can_create_self_assessment():
    medical=token("medical"); response=client.post("/api/astronauts/1/assessments",headers={"Authorization":f"Bearer {medical}"},json={"sleep_hours":7,"sleep_quality":7,"stress":3,"mood":7,"fatigue":2})
    assert response.status_code==403
    maya=token("maya"); response=client.post("/api/astronauts/2/assessments",headers={"Authorization":f"Bearer {maya}"},json={"sleep_hours":7,"sleep_quality":7,"stress":3,"mood":7,"fatigue":2})
    assert response.status_code==403

def test_medical_only_report_generation_and_audit():
    astronaut=token("maya")
    denied=client.post("/api/astronauts/1/reports/daily/generate?day=42",headers={"Authorization":f"Bearer {astronaut}"})
    assert denied.status_code==403
    medical=token("medical")
    created=client.post("/api/astronauts/1/reports/daily/generate?day=42",headers={"Authorization":f"Bearer {medical}"})
    assert created.status_code==200
    assert created.json()["report"]["verified"] is False
    assert "not clinically validated" in created.json()["report"]["executive_summary"]
    records=client.get("/api/astronauts/1/medical-records",headers={"Authorization":f"Bearer {medical}"}).json()
    assert records[0]["status"]=="Pending clinician review"
    audit=client.get("/api/audit-events",headers={"Authorization":f"Bearer {medical}"})
    assert audit.status_code==200 and any(x["action"]=="daily_summary_generated" for x in audit.json())

def test_countermeasure_checklist_is_persisted_and_isolated():
    maya=token("maya"); headers={"Authorization":f"Bearer {maya}"}
    date="2026-11-14"
    before=client.get(f"/api/astronauts/1/countermeasures?date={date}",headers=headers)
    assert before.status_code==200 and before.json()["completion_percent"]==0
    saved=client.put(f"/api/astronauts/1/countermeasures/aerobic?date={date}",headers=headers,json={"completed":True,"session_minutes":30,"session_note":"Demo check-in"})
    assert saved.status_code==200 and saved.json()["completed"] is True
    after=client.get(f"/api/astronauts/1/countermeasures?date={date}",headers=headers)
    assert after.json()["completion_percent"]==25
    assert after.json()["items"][0]["check"]["session_minutes"]==30
    forbidden=client.put(f"/api/astronauts/2/countermeasures/aerobic?date={date}",headers=headers,json={"completed":True})
    assert forbidden.status_code==403

def test_pdf_candidate_requires_medical_review():
    import io
    from pypdf import PdfWriter
    stream=io.BytesIO(); writer=PdfWriter(); writer.add_blank_page(width=200,height=200); writer.write(stream)
    medical=token("medical")
    response=client.post("/api/astronauts/1/documents",headers={"Authorization":f"Bearer {medical}"},files={"file":("demo.pdf",stream.getvalue(),"application/pdf")})
    assert response.status_code==200
    report=response.json()
    assert report["verified"] is False
    assert report["extraction_method"] in {"ocr_unavailable", "ocr_empty", "selectable_text"}
    astronaut=token("maya")
    sample=client.get("/api/astronauts/1/documents",headers={"Authorization":f"Bearer {astronaut}"}).json()[0]
    assert all(not item["verified"] for item in sample["observations"])
    invalid=client.post("/api/astronauts/1/documents",headers={"Authorization":f"Bearer {medical}"},files={"file":("broken.pdf",b"not a pdf","application/pdf")})
    assert invalid.status_code==400

def test_optional_ocr_path_creates_unverified_candidate(monkeypatch):
    import io, sys
    from types import SimpleNamespace
    import pytest
    fitz=pytest.importorskip("fitz"); pytest.importorskip("PIL")
    monkeypatch.setitem(sys.modules,"pytesseract",SimpleNamespace(image_to_string=lambda image:"Hemoglobin 14.2 g/dL"))
    from pypdf import PdfWriter
    stream=io.BytesIO(); writer=PdfWriter(); writer.add_blank_page(width=200,height=200); writer.write(stream)
    medical=token("medical")
    response=client.post("/api/astronauts/1/documents",headers={"Authorization":f"Bearer {medical}"},files={"file":("scan.pdf",stream.getvalue(),"application/pdf")})
    assert response.status_code==200
    payload=response.json()
    assert payload["extraction_method"]=="optional_ocr"
    assert payload["observations"] and payload["observations"][0]["test_name"]=="Hemoglobin"
    assert payload["observations"][0]["verified"] is False

def test_observation_approval_is_medical_only_and_audited():
    medical=token("medical"); headers={"Authorization":f"Bearer {medical}"}
    docs=client.get("/api/astronauts/1/documents",headers=headers).json()
    observation=next(o for d in docs for o in d["observations"])
    astronaut=token("maya")
    denied=client.post(f"/api/observations/{observation['id']}/verify",headers={"Authorization":f"Bearer {astronaut}"},json={})
    assert denied.status_code==403
    approved=client.post(f"/api/observations/{observation['id']}/verify",headers=headers,json={"test_name":"Reviewed demo note","review_note":"checked"})
    assert approved.status_code==200 and approved.json()["review_status"]=="approved"
    assert approved.json()["verified"] is True
