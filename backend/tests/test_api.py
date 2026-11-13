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
