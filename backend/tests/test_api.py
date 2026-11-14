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
