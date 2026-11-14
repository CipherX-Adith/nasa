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
    assert status.status_code==200 and status.json()["mode"]=="Local evidence"
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
