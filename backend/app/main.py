import os, re, random, json, urllib.request
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from pydantic import BaseModel, Field
from .db import Base, engine, get_db
from .models import User, Astronaut, Measurement, Alert, Assessment, MedicalRecord, MedicalDocument, MedicalObservation
from .core import verify_password, hash_password, make_token, read_token
from .intelligence import baseline, detect

app = FastAPI(title="ORBITCARE", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def ensure_schema():
    with engine.connect() as conn:
        try:
            res = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            cols = {r[1] for r in res}
            if "status" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR DEFAULT 'approved'"))
            if "full_name" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR DEFAULT ''"))
            if "call_sign" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN call_sign VARCHAR DEFAULT ''"))
            if "mission" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN mission VARCHAR DEFAULT 'Asteria-7'"))
            if "specialization" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN specialization VARCHAR DEFAULT 'Mission Specialist'"))
            if "created_at" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME"))
            conn.commit()
        except Exception as e:
            print("Schema migration note:", e)

ensure_schema()
Base.metadata.create_all(bind=engine)

FIREBASE_DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "https://orbitcare-afcc9-default-rtdb.asia-southeast1.firebasedatabase.app")

def fb_request(path: str, data: dict | list | None = None, method: str = "GET"):
    url = f"{FIREBASE_DATABASE_URL.rstrip('/')}/{path.lstrip('/')}.json"
    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else None
    except Exception as e:
        print(f"Firebase {method} {path} note:", e)
        return None

def sync_from_firebase(db: Session):
    try:
        # 1. Astronauts from Firebase
        astros_data = fb_request("astronauts")
        if astros_data:
            items = astros_data if isinstance(astros_data, list) else list(astros_data.values())
            for item in items:
                if not item or not isinstance(item, dict):
                    continue
                aid = item.get("id")
                if aid and not db.get(Astronaut, aid):
                    db.add(Astronaut(
                        id=aid,
                        name=item.get("name", "Astronaut"),
                        call_sign=item.get("call_sign", ""),
                        mission=item.get("mission", "Asteria-7"),
                        status=item.get("status", "Active"),
                        simulated=item.get("simulated", False),
                    ))
            db.commit()

        # 2. Users from Firebase
        users_data = fb_request("users")
        if users_data:
            items = users_data.values() if isinstance(users_data, dict) else users_data
            for u in items:
                if not u or not isinstance(u, dict):
                    continue
                uname = u.get("username")
                if not uname:
                    continue
                if not db.query(User).filter_by(username=uname).first():
                    db.add(User(
                        username=uname,
                        password_hash=u.get("password_hash") or hash_password(u.get("password", "orbitcare-demo")),
                        role=u.get("role", "astronaut"),
                        status=u.get("status", "approved"),
                        full_name=u.get("full_name") or u.get("name") or uname.title(),
                        call_sign=u.get("call_sign", ""),
                        mission=u.get("mission", "Asteria-7"),
                        specialization=u.get("specialization", "Flight Crew"),
                        astronaut_id=u.get("astronaut_id"),
                    ))
            db.commit()

        # 3. Measurements from Firebase
        meas_data = fb_request("measurements")
        if meas_data:
            groups = meas_data.values() if isinstance(meas_data, dict) else meas_data
            for group in groups:
                if not group:
                    continue
                items = group.values() if isinstance(group, dict) else group
                for m in items:
                    if not m or not isinstance(m, dict):
                        continue
                    mid = m.get("id")
                    int_mid = int(mid) if str(mid).isdigit() else None
                    if int_mid and not db.get(Measurement, int_mid):
                        ts_str = m.get("timestamp")
                        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if ts_str else datetime.now(timezone.utc)
                        db.add(Measurement(
                            id=int_mid,
                            astronaut_id=m.get("astronaut_id"),
                            domain=m.get("domain", "cardiovascular"),
                            metric=m.get("metric", "Resting heart rate"),
                            value=float(m.get("value", 0)),
                            unit=m.get("unit", "bpm"),
                            timestamp=ts,
                            source=m.get("source", "Telemetry downlink"),
                            quality=m.get("quality", "good"),
                            simulated=m.get("simulated", False),
                        ))
            db.commit()

        # 4. Assessments from Firebase
        ass_data = fb_request("assessments")
        if ass_data:
            groups = ass_data.values() if isinstance(ass_data, dict) else ass_data
            for group in groups:
                if not group:
                    continue
                items = group.values() if isinstance(group, dict) else group
                for a in items:
                    if not a or not isinstance(a, dict):
                        continue
                    aid_ass = a.get("id")
                    int_id = int(aid_ass) if str(aid_ass).isdigit() else None
                    if int_id and not db.get(Assessment, int_id):
                        ts_str = a.get("timestamp")
                        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if ts_str else datetime.now(timezone.utc)
                        db.add(Assessment(
                            id=int_id,
                            astronaut_id=a.get("astronaut_id"),
                            sleep_hours=float(a.get("sleep_hours", 7.5)),
                            sleep_quality=int(a.get("sleep_quality", 7)),
                            stress=int(a.get("stress", 3)),
                            mood=int(a.get("mood", 7)),
                            fatigue=int(a.get("fatigue", 2)),
                            symptoms=a.get("symptoms", "None reported"),
                            timestamp=ts,
                            source=a.get("source", "Astronaut self-report"),
                            simulated=a.get("simulated", False),
                        ))
            db.commit()

        # 5. Medical Records from Firebase
        mr_data = fb_request("medical_records")
        if mr_data:
            groups = mr_data.values() if isinstance(mr_data, dict) else mr_data
            for group in groups:
                if not group:
                    continue
                items = group.values() if isinstance(group, dict) else group
                for r in items:
                    if not r or not isinstance(r, dict):
                        continue
                    rid = r.get("id")
                    int_rid = int(rid) if str(rid).isdigit() else None
                    if int_rid and not db.get(MedicalRecord, int_rid):
                        ts_str = r.get("timestamp")
                        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if ts_str else datetime.now(timezone.utc)
                        db.add(MedicalRecord(
                            id=int_rid,
                            astronaut_id=r.get("astronaut_id"),
                            record_type=r.get("record_type", "Clinical Evaluation"),
                            title=r.get("title", "Evaluation"),
                            physician=r.get("physician", "Flight Surgeon"),
                            findings=r.get("findings", ""),
                            countermeasures=r.get("countermeasures", ""),
                            status=r.get("status", "Signed & Verified"),
                            date=r.get("date", ""),
                            timestamp=ts,
                        ))
            db.commit()

        # 6. Alerts from Firebase
        alerts_data = fb_request("alerts")
        if alerts_data:
            items = alerts_data.values() if isinstance(alerts_data, dict) else alerts_data
            for alt in items:
                if not alt or not isinstance(alt, dict):
                    continue
                alt_id = alt.get("id")
                int_alt = int(alt_id) if str(alt_id).isdigit() else None
                if int_alt and not db.get(Alert, int_alt):
                    ts_str = alt.get("created_at")
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if ts_str else datetime.now(timezone.utc)
                    db.add(Alert(
                        id=int_alt,
                        astronaut_id=alt.get("astronaut_id"),
                        measurement_id=alt.get("measurement_id"),
                        metric=alt.get("metric", "Resting heart rate"),
                        priority=alt.get("priority", "medium"),
                        reason=alt.get("reason", ""),
                        acknowledged=alt.get("acknowledged", False),
                        follow_up=alt.get("follow_up"),
                        created_at=ts,
                    ))
            db.commit()
    except Exception as e:
        print("Firebase sync error:", e)

with next(get_db()) as db:
    sync_from_firebase(db)

def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sign in required")
    payload = read_token(authorization[7:])
    user = db.query(User).filter_by(username=(payload or {}).get("sub")).first() if payload else None
    if not user:
        raise HTTPException(401, "Invalid session")
    return user

def medical(user = Depends(current_user)):
    if user.role != "medical":
        raise HTTPException(403, "Medical officer access required")
    return user

def allowed(user, astronaut_id: int):
    if user.role != "medical" and user.astronaut_id != astronaut_id:
        raise HTTPException(403, "You can only access your own records")

def serialize(row):
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}

def refresh_alerts(db: Session):
    existing = {a.measurement_id for a in db.query(Alert).all()}
    for item in detect(db.query(Measurement).order_by(Measurement.timestamp).all()):
        if item["measurement_id"] not in existing:
            db.add(Alert(
                astronaut_id=item["astronaut_id"],
                measurement_id=item["measurement_id"],
                metric=item["metric"],
                priority=item["priority"],
                reason=item["reason"]
            ))
    db.commit()

def seed_new_astronaut_baseline(db: Session, aid: int):
    now = datetime.now(timezone.utc)
    metrics = [
        ("cardiovascular", "Resting heart rate", "bpm", 68.0),
        ("cardiovascular", "HRV", "ms", 62.0),
        ("cardiovascular", "Systolic BP", "mmHg", 116.0),
        ("immune", "Core Temp", "°C", 36.6),
        ("musculoskeletal", "Grip", "kg", 46.0),
        ("musculoskeletal", "Body mass", "kg", 72.0),
        ("behavioural", "Sleep duration", "hours", 7.6),
        ("behavioural", "Fatigue", "/10", 2.2),
        ("behavioural", "Sleep quality", "/10", 7.8),
        ("behavioural", "Stress", "/10", 2.5),
        ("behavioural", "Mood", "/10", 8.0),
        ("radiation_environment", "Cabin CO2", "mmHg", 2.4),
        ("radiation_environment", "Radiation dose rate", "mSv/day", 0.41),
    ]
    fb_meas = []
    for domain, metric, unit, base in metrics:
        for day_idx in range(1, 31):
            ts = now - timedelta(days=(30 - day_idx))
            val = round(base + random.uniform(-1.5, 1.5), 2)
            m = Measurement(
                astronaut_id=aid,
                domain=domain,
                metric=metric,
                value=val,
                unit=unit,
                timestamp=ts,
                source="Initial flight baseline",
                simulated=False
            )
            db.add(m)
            fb_meas.append({
                "astronaut_id": aid,
                "domain": domain,
                "metric": metric,
                "value": val,
                "unit": unit,
                "timestamp": ts.isoformat(),
                "source": "Initial flight baseline",
                "simulated": False
            })
    fb_ass = []
    for day_idx in range(1, 31):
        ts = now - timedelta(days=(30 - day_idx))
        db.add(Assessment(
            astronaut_id=aid,
            sleep_hours=7.5,
            sleep_quality=8,
            stress=2,
            mood=8,
            fatigue=2,
            symptoms="Nominal pre-flight readiness",
            timestamp=ts,
            source="Pre-flight baseline assessment",
            simulated=False
        ))
        fb_ass.append({
            "astronaut_id": aid,
            "sleep_hours": 7.5,
            "sleep_quality": 8,
            "stress": 2,
            "mood": 8,
            "fatigue": 2,
            "symptoms": "Nominal pre-flight readiness",
            "timestamp": ts.isoformat(),
            "source": "Pre-flight baseline assessment",
            "simulated": False
        })
    db.commit()
    fb_request(f"measurements/{aid}", fb_meas, method="PUT")
    fb_request(f"assessments/{aid}", fb_ass, method="PUT")

class Login(BaseModel):
    username: str
    password: str

class RegisterIn(BaseModel):
    username: str
    password: str
    full_name: str
    call_sign: str = ""
    mission: str = "Asteria-7"
    specialization: str = "Mission Specialist"

class DirectAstronautIn(BaseModel):
    name: str
    username: str
    password: str = "orbitcare-demo"
    call_sign: str = ""
    mission: str = "Asteria-7"
    specialization: str = "Mission Specialist"

class AssessmentIn(BaseModel):
    sleep_hours: float = Field(ge=0, le=24)
    sleep_quality: int = Field(ge=1, le=10)
    stress: int = Field(ge=1, le=10)
    mood: int = Field(ge=1, le=10)
    fatigue: int = Field(ge=1, le=10)
    symptoms: str = "None reported"

class MedicalRecordIn(BaseModel):
    record_type: str = "Clinical Evaluation"
    title: str
    physician: str = "Flight Surgeon"
    findings: str
    countermeasures: str = ""
    status: str = "Signed & Verified"
    date: str = ""

class Followup(BaseModel):
    note: str = Field(min_length=1, max_length=2000)

class Ask(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    astronaut_id: int | None = None

class MeasurementIn(BaseModel):
    domain: str
    metric: str
    value: float
    unit: str
    timestamp: datetime | None = None
    source: str = "Manual entry"
    quality: str = "good"

@app.get("/")
@app.get("/api")
@app.get("/api/health")
def health():
    return {"status": "ok", "app": "ORBITCARE"}

# ----------------- AUTHENTICATION & REGISTRATION -----------------

@app.post("/api/auth/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    uname = data.username.strip().lower()
    if not uname or len(uname) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if not data.password or len(data.password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")
    
    existing = db.query(User).filter_by(username=uname).first()
    if existing:
        raise HTTPException(400, "Username already registered in mission database")
    
    call_sign = (data.call_sign or f"CREW-{random.randint(10, 99)}").strip().upper()
    user = User(
        username=uname,
        password_hash=hash_password(data.password),
        role="astronaut",
        status="pending_approval",
        full_name=data.full_name.strip() or uname.title(),
        call_sign=call_sign,
        mission=data.mission.strip() or "Asteria-7",
        specialization=data.specialization.strip() or "Mission Specialist",
        astronaut_id=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Sync to Firebase Realtime Database
    fb_request(f"users/{uname}", {
        "id": user.id,
        "username": user.username,
        "password_hash": user.password_hash,
        "role": user.role,
        "status": user.status,
        "full_name": user.full_name,
        "call_sign": user.call_sign,
        "mission": user.mission,
        "specialization": user.specialization,
        "astronaut_id": user.astronaut_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }, method="PUT")

    return {
        "status": "pending_approval",
        "username": user.username,
        "message": "Astronaut registration submitted. Flight clearance pending Flight Surgeon / Administrator approval."
    }

@app.post("/api/auth/login")
def login(data: Login, db: Session = Depends(get_db)):
    uname = data.username.strip().lower()
    user = db.query(User).filter_by(username=uname).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid username or password")
    
    # Check approval status
    if getattr(user, "status", "approved") == "pending_approval":
        raise HTTPException(403, "Account pending Flight Surgeon clearance: Your astronaut credentials have been registered and are awaiting Admin approval before flight access is granted.")
    if getattr(user, "status", "approved") == "rejected":
        raise HTTPException(403, "Flight clearance rejected: This astronaut account was declined by Mission Control.")

    return {
        "access_token": make_token(user.username, user.role),
        "role": user.role,
        "username": user.username,
        "astronaut_id": user.astronaut_id,
        "full_name": getattr(user, "full_name", user.username.title()),
        "status": getattr(user, "status", "approved")
    }

@app.get("/api/auth/me")
def me(user = Depends(current_user)):
    return {
        "username": user.username,
        "role": user.role,
        "astronaut_id": user.astronaut_id,
        "full_name": getattr(user, "full_name", user.username.title()),
        "status": getattr(user, "status", "approved")
    }

# ----------------- ADMIN CONTROLS & APPROVALS -----------------

@app.get("/api/admin/users")
def get_all_users(db: Session = Depends(get_db), user = Depends(medical)):
    users = db.query(User).all()
    res = []
    for u in users:
        astro = db.get(Astronaut, u.astronaut_id) if u.astronaut_id else None
        res.append({
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "status": getattr(u, "status", "approved") or "approved",
            "full_name": getattr(u, "full_name", "") or (astro.name if astro else u.username.title()),
            "call_sign": getattr(u, "call_sign", "") or (astro.call_sign if astro else ""),
            "mission": getattr(u, "mission", "") or (astro.mission if astro else "Asteria-7"),
            "specialization": getattr(u, "specialization", "") or "Flight Crew",
            "astronaut_id": u.astronaut_id,
            "created_at": getattr(u, "created_at", None),
        })
    return res

@app.post("/api/admin/users/{user_id}/approve")
def approve_user(user_id: int, db: Session = Depends(get_db), admin = Depends(medical)):
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(404, "User not found")
    
    target_user.status = "approved"
    astro = None
    
    # If no astronaut assigned, create a new Astronaut profile in the mission roster
    if not target_user.astronaut_id:
        name = getattr(target_user, "full_name", None) or target_user.username.title()
        call_sign = getattr(target_user, "call_sign", None) or f"CREW-{random.randint(10, 99)}"
        mission = getattr(target_user, "mission", None) or "Asteria-7"
        
        astro = Astronaut(name=name, call_sign=call_sign, mission=mission, status="Active", simulated=False)
        db.add(astro)
        db.flush()
        
        target_user.astronaut_id = astro.id
        # Seed baseline vitals and health assessments for the newly approved astronaut
        seed_new_astronaut_baseline(db, astro.id)
    
    db.commit()
    db.refresh(target_user)

    # Sync to Firebase Realtime Database
    fb_request(f"users/{target_user.username}", {
        "id": target_user.id,
        "username": target_user.username,
        "password_hash": target_user.password_hash,
        "role": target_user.role,
        "status": target_user.status,
        "full_name": target_user.full_name,
        "call_sign": target_user.call_sign,
        "mission": target_user.mission,
        "specialization": target_user.specialization,
        "astronaut_id": target_user.astronaut_id,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": admin.username,
    }, method="PUT")

    if astro:
        fb_request(f"astronauts/{astro.id}", {
            "id": astro.id,
            "name": astro.name,
            "call_sign": astro.call_sign,
            "mission": astro.mission,
            "status": astro.status,
            "simulated": astro.simulated,
        }, method="PUT")

    return {
        "message": f"Astronaut account '{target_user.username}' approved and enlisted into flight roster.",
        "user_id": target_user.id,
        "status": "approved",
        "astronaut_id": target_user.astronaut_id
    }

@app.post("/api/admin/users/{user_id}/reject")
def reject_user(user_id: int, db: Session = Depends(get_db), admin = Depends(medical)):
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(404, "User not found")
    target_user.status = "rejected"
    db.commit()
    fb_request(f"users/{target_user.username}/status", "rejected", method="PUT")
    return {"message": f"User '{target_user.username}' rejected.", "status": "rejected"}

@app.post("/api/admin/astronauts/create")
def direct_create_astronaut(data: DirectAstronautIn, db: Session = Depends(get_db), admin = Depends(medical)):
    uname = data.username.strip().lower()
    if db.query(User).filter_by(username=uname).first():
        raise HTTPException(400, "Username already exists")
    
    astro = Astronaut(
        name=data.name.strip(),
        call_sign=data.call_sign.strip() or f"ASTRO-{random.randint(10, 99)}",
        mission=data.mission.strip() or "Asteria-7",
        status="Active",
        simulated=False
    )
    db.add(astro)
    db.flush()
    
    user = User(
        username=uname,
        password_hash=hash_password(data.password),
        role="astronaut",
        status="approved",
        full_name=data.name.strip(),
        call_sign=astro.call_sign,
        mission=astro.mission,
        specialization=data.specialization.strip(),
        astronaut_id=astro.id
    )
    db.add(user)
    db.flush()
    
    seed_new_astronaut_baseline(db, astro.id)
    db.commit()

    fb_request(f"astronauts/{astro.id}", serialize(astro), method="PUT")
    fb_request(f"users/{user.username}", {
        "id": user.id,
        "username": user.username,
        "password_hash": user.password_hash,
        "role": user.role,
        "status": user.status,
        "full_name": user.full_name,
        "call_sign": user.call_sign,
        "mission": user.mission,
        "specialization": user.specialization,
        "astronaut_id": user.astronaut_id,
        "approved_at": datetime.now(timezone.utc).isoformat(),
    }, method="PUT")
    
    return {
        "message": f"Astronaut '{data.name}' created and cleared for flight.",
        "astronaut": serialize(astro),
        "username": uname
    }

# ----------------- ASTRONAUTS & TELEMETRY -----------------

@app.get("/api/astronauts")
def astronauts(db: Session = Depends(get_db), user = Depends(current_user)):
    if user.role == "medical":
        return [serialize(x) for x in db.query(Astronaut).all()]
    astro = db.get(Astronaut, user.astronaut_id) if user.astronaut_id else None
    return [serialize(astro)] if astro else []

@app.post("/api/astronauts")
def create_astronaut(data: dict, db: Session = Depends(get_db), user = Depends(medical)):
    a = Astronaut(name=data["name"], call_sign=data["call_sign"], mission=data.get("mission", "Asteria-7"))
    db.add(a)
    db.commit()
    db.refresh(a)
    seed_new_astronaut_baseline(db, a.id)
    return serialize(a)

@app.get("/api/astronauts/{aid}/measurements")
def measurements(aid: int, metric: str | None = None, db: Session = Depends(get_db), user = Depends(current_user)):
    allowed(user, aid)
    q = db.query(Measurement).filter_by(astronaut_id=aid)
    if metric:
        q = q.filter_by(metric=metric)
    return [serialize(x) for x in q.order_by(Measurement.timestamp).all()]

@app.post("/api/astronauts/{aid}/measurements")
def add_measurement(aid: int, data: MeasurementIn, db: Session = Depends(get_db), user = Depends(current_user)):
    allowed(user, aid)
    if not db.get(Astronaut, aid):
        raise HTTPException(404, "Astronaut not found")
    x = Measurement(
        astronaut_id=aid,
        **data.model_dump(exclude={"timestamp"}),
        timestamp=data.timestamp or datetime.now(timezone.utc),
        simulated=False
    )
    db.add(x)
    db.commit()
    db.refresh(x)
    fb_request(f"measurements/{aid}/{x.id}", {
        "id": x.id,
        "astronaut_id": x.astronaut_id,
        "domain": x.domain,
        "metric": x.metric,
        "value": x.value,
        "unit": x.unit,
        "timestamp": x.timestamp.isoformat(),
        "source": x.source,
        "quality": x.quality,
        "simulated": x.simulated,
    }, method="PUT")
    refresh_alerts(db)
    return serialize(x)

@app.post("/api/astronauts/{aid}/telemetry/live-tick")
def live_telemetry_tick(aid: int, db: Session = Depends(get_db), user = Depends(current_user)):
    allowed(user, aid)
    a = db.get(Astronaut, aid)
    if not a:
        raise HTTPException(404, "Astronaut not found")
    
    # Base target HR: Maya Chen at Day 60 is elevated (~84.0 bpm), others nominal (~68.0 bpm)
    target_base = 84.0 if aid == 1 else 68.0
    jitter = round(random.uniform(-1.2, 1.2), 1)
    new_hr = round(target_base + jitter, 1)

    payload = {
        "id": int(datetime.now(timezone.utc).timestamp() * 1000),
        "astronaut_id": aid,
        "domain": "cardiovascular",
        "metric": "Resting heart rate",
        "value": new_hr,
        "unit": "bpm",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "Live telemetry downlink",
        "quality": "good",
        "simulated": False
    }
    return payload

@app.get("/api/astronauts/{aid}/baselines")
def baselines(aid: int, db: Session = Depends(get_db), user = Depends(current_user)):
    allowed(user, aid)
    rows = db.query(Measurement).filter_by(astronaut_id=aid).all()
    groups = {}
    for r in rows:
        groups.setdefault((r.metric, r.unit, r.domain), []).append(r)
    return [{"metric": m, "unit": u, "domain": d, **baseline([x.value for x in rs])} for (m, u, d), rs in groups.items()]

# ----------------- ASSESSMENTS & DAILY HEALTH DATA -----------------

@app.get("/api/astronauts/{aid}/assessments")
def assessments(aid: int, db: Session = Depends(get_db), user = Depends(current_user)):
    allowed(user, aid)
    return [serialize(x) for x in db.query(Assessment).filter_by(astronaut_id=aid).order_by(Assessment.timestamp).all()]

@app.post("/api/astronauts/{aid}/assessments")
def add_assessment(aid: int, data: AssessmentIn, db: Session = Depends(get_db), user = Depends(current_user)):
    allowed(user, aid)
    x = Assessment(astronaut_id=aid, **data.model_dump())
    db.add(x)
    db.commit()
    db.refresh(x)
    fb_request(f"assessments/{aid}/{x.id}", {
        "id": x.id,
        "astronaut_id": x.astronaut_id,
        "sleep_hours": x.sleep_hours,
        "sleep_quality": x.sleep_quality,
        "stress": x.stress,
        "mood": x.mood,
        "fatigue": x.fatigue,
        "symptoms": x.symptoms,
        "timestamp": x.timestamp.isoformat(),
        "source": x.source,
        "simulated": x.simulated,
    }, method="PUT")
    return serialize(x)

# ----------------- MEDICAL RECORDS & CLINICAL EVALUATIONS -----------------

@app.get("/api/astronauts/{aid}/medical-records")
def get_medical_records(aid: int, db: Session = Depends(get_db), user = Depends(current_user)):
    allowed(user, aid)
    records = db.query(MedicalRecord).filter_by(astronaut_id=aid).order_by(desc(MedicalRecord.timestamp)).all()
    return [serialize(r) for r in records]

@app.post("/api/astronauts/{aid}/medical-records")
def add_medical_record(aid: int, data: MedicalRecordIn, db: Session = Depends(get_db), user = Depends(medical)):
    rec = MedicalRecord(
        astronaut_id=aid,
        record_type=data.record_type,
        title=data.title,
        physician=data.physician or f"Dr. {user.username.title()}, Flight Surgeon",
        findings=data.findings,
        countermeasures=data.countermeasures,
        status=data.status or "Signed & Verified",
        date=data.date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        timestamp=datetime.now(timezone.utc)
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    fb_request(f"medical_records/{aid}/{rec.id}", {
        "id": rec.id,
        "astronaut_id": rec.astronaut_id,
        "record_type": rec.record_type,
        "title": rec.title,
        "physician": rec.physician,
        "findings": rec.findings,
        "countermeasures": rec.countermeasures,
        "status": rec.status,
        "date": rec.date,
        "timestamp": rec.timestamp.isoformat(),
    }, method="PUT")
    return serialize(rec)

# ----------------- ALERTS & PROTOCOLS -----------------

@app.get("/api/alerts")
def alerts(astronaut_id: int | None = None, db: Session = Depends(get_db), user = Depends(current_user)):
    refresh_alerts(db)
    q = db.query(Alert)
    if user.role != "medical":
        q = q.filter_by(astronaut_id=user.astronaut_id)
    elif astronaut_id:
        q = q.filter_by(astronaut_id=astronaut_id)
    return [serialize(x) for x in q.order_by(desc(Alert.created_at)).all()]

@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge(alert_id: int, data: Followup, db: Session = Depends(get_db), user = Depends(medical)):
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "Alert not found")
    a.acknowledged = True
    a.acknowledged_by = user.username
    a.follow_up = data.note
    db.commit()
    fb_request(f"alerts/{alert_id}", {
        "acknowledged": True,
        "acknowledged_by": a.acknowledged_by,
        "follow_up": a.follow_up,
        "acknowledged_at": datetime.now(timezone.utc).isoformat(),
    }, method="PATCH")
    return serialize(a)

# ----------------- MEDICAL DOCUMENTS & PDF OCR -----------------

@app.get("/api/astronauts/{aid}/documents")
def documents(aid: int, db: Session = Depends(get_db), user = Depends(current_user)):
    allowed(user, aid)
    return [
        {
            **serialize(x),
            "observations": [serialize(o) for o in db.query(MedicalObservation).filter_by(document_id=x.id).all()]
        }
        for x in db.query(MedicalDocument).filter_by(astronaut_id=aid).order_by(desc(MedicalDocument.uploaded_at)).all()
    ]

@app.post("/api/astronauts/{aid}/documents")
async def upload_document(aid: int, file: UploadFile = File(...), db: Session = Depends(get_db), user = Depends(medical)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Upload a PDF report")
    content = await file.read()
    try:
        try:
            import pypdf, io
            reader = pypdf.PdfReader(io.BytesIO(content))
            text_extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            text_extracted = "\n".join(page.get_text() for page in doc)
    except Exception as e:
        raise HTTPException(400, f"Could not read PDF: {e}")
    
    if not text_extracted.strip():
        text_extracted = "No selectable text found. OCR was not available; values require manual review."
    
    report = MedicalDocument(
        astronaut_id=aid,
        filename=file.filename,
        extracted_text=text_extracted[:50000],
        confidence=.82 if len(text_extracted) > 30 else .25
    )
    db.add(report)
    db.flush()
    
    for line in text_extracted.splitlines():
        match = re.match(r"\s*([A-Za-z][A-Za-z0-9 /()-]{1,50}?)\s{1,}(\d+(?:\.\d+)?)\s*([A-Za-z/%µμ^0-9.-]{0,16})\s*(?:\((?:ref(?:erence)?\s*)?([^)]{1,30})\))?\s*$", line, re.I)
        if match:
            db.add(MedicalObservation(
                document_id=report.id,
                test_name=match.group(1).strip(),
                result=match.group(2),
                unit=match.group(3).strip(),
                reference_range=(match.group(4) or "Unknown").strip(),
                confidence=.55 if len(text_extracted) > 30 else .25
            ))
    db.commit()
    db.refresh(report)
    return {
        **serialize(report),
        "observations": [serialize(o) for o in db.query(MedicalObservation).filter_by(document_id=report.id).all()]
    }

@app.post("/api/documents/{doc_id}/verify")
def verify_document(doc_id: int, db: Session = Depends(get_db), user = Depends(medical)):
    d = db.get(MedicalDocument, doc_id)
    if not d:
        raise HTTPException(404, "Document not found")
    d.verified = True
    d.confidence = 1
    db.commit()
    return serialize(d)

@app.get("/api/documents/{doc_id}/observations")
def document_observations(doc_id: int, db: Session = Depends(get_db), user = Depends(current_user)):
    d = db.get(MedicalDocument, doc_id)
    if not d:
        raise HTTPException(404, "Document not found")
    allowed(user, d.astronaut_id)
    return [serialize(o) for o in db.query(MedicalObservation).filter_by(document_id=doc_id).all()]

@app.post("/api/observations/{observation_id}/verify")
def verify_observation(observation_id: int, db: Session = Depends(get_db), user = Depends(medical)):
    o = db.get(MedicalObservation, observation_id)
    if not o:
        raise HTTPException(404, "Observation not found")
    o.verified = True
    o.confidence = 1
    db.commit()
    return serialize(o)

# ----------------- TIMELINE & ASSISTANT -----------------

@app.get("/api/timeline/{aid}")
def timeline(aid: int, db: Session = Depends(get_db), user = Depends(current_user)):
    allowed(user, aid)
    events = []
    for x in db.query(Measurement).filter_by(astronaut_id=aid).all():
        events.append({"id": f"m{x.id}", "timestamp": x.timestamp, "type": "measurement", "title": x.metric, "detail": f"{x.value} {x.unit} · {x.source}", "simulated": x.simulated})
    for x in db.query(Assessment).filter_by(astronaut_id=aid).all():
        events.append({"id": f"a{x.id}", "timestamp": x.timestamp, "type": "assessment", "title": "Daily health assessment", "detail": f"Sleep {x.sleep_hours}h · Fatigue {x.fatigue}/10 · Stress {x.stress}/10", "simulated": x.simulated})
    for x in db.query(MedicalRecord).filter_by(astronaut_id=aid).all():
        events.append({"id": f"r{x.id}", "timestamp": x.timestamp, "type": "record", "title": f"{x.record_type}: {x.title}", "detail": f"{x.physician} · {x.findings[:80]}…", "simulated": False})
    for x in db.query(Alert).filter_by(astronaut_id=aid).all():
        events.append({"id": f"l{x.id}", "timestamp": x.created_at, "type": "alert", "title": f"{x.priority.title()} alert: {x.metric}", "detail": x.reason, "simulated": True})
    for x in db.query(MedicalDocument).filter_by(astronaut_id=aid).all():
        events.append({"id": f"d{x.id}", "timestamp": x.uploaded_at, "type": "document", "title": f"Report uploaded: {x.filename}", "detail": "Verified" if x.verified else "Extracted observations pending human review", "simulated": False})
    return sorted(events, key=lambda x: x["timestamp"], reverse=True)

@app.post("/api/assistant/ask")
def ask(data: Ask, db: Session = Depends(get_db), user = Depends(current_user)):
    aid = data.astronaut_id or user.astronaut_id
    if not aid:
        raise HTTPException(400, "Select an astronaut")
    allowed(user, aid)
    rows = db.query(Measurement).filter_by(astronaut_id=aid).order_by(desc(Measurement.timestamp)).limit(80).all()
    als = db.query(Alert).filter_by(astronaut_id=aid).order_by(desc(Alert.created_at)).limit(15).all()
    docs = db.query(MedicalDocument).filter_by(astronaut_id=aid).order_by(desc(MedicalDocument.uploaded_at)).limit(5).all()
    recs = db.query(MedicalRecord).filter_by(astronaut_id=aid).order_by(desc(MedicalRecord.timestamp)).limit(5).all()
    evidence = "\n".join(
        [f"{r.metric}: {r.value} {r.unit} at {r.timestamp} ({r.source})" for r in rows[:30]]
        + [f"Alert {a.priority}: {a.reason}" for a in als]
        + [f"Medical Record ({rc.record_type}): {rc.title} - Findings: {rc.findings} - Countermeasures: {rc.countermeasures}" for rc in recs]
        + [f"Report {d.filename}: {d.extracted_text[:800]}" for d in docs]
    ) or "No health records available."
    
    key = os.getenv("GEMINI_API_KEY")
    if key:
        try:
            import httpx
            prompt = f"You are a cautious astronaut health information assistant, not a clinician. Answer only from the evidence below; distinguish observations from interpretation; cite evidence; state what is missing. Do not diagnose, recommend treatment, or infer causation.\nEVIDENCE:\n{evidence}\nQUESTION: {data.question}"
            resp = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=25.0
            )
            if resp.status_code == 200:
                text_ans = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                return {"answer": text_ans, "mode": "Gemini grounded", "evidence": evidence[:5000]}
        except Exception:
            pass
    
    facts = []
    for metric in re.findall(r"heart rate|HRV|sleep duration|fatigue|temperature|body mass|CO2|radiation", data.question, re.I):
        candidates = [r for r in rows if metric.lower() in r.metric.lower()]
        if candidates:
            facts.extend([f"Observed {r.metric}: {r.value} {r.unit} at {r.timestamp} (source: {r.source})." for r in candidates[:4]])
    facts.extend([f"Alert: {a.reason}" for a in als[:4]])
    answer = "Evidence retrieved from available project records:\n- " + "\n- ".join(facts[:8]) if facts else "I could not find a specific matching measurement in the available records. Please specify a metric or astronaut. The Gemini service is not configured, so this response uses the local evidence fallback."
    answer += "\n\nThese are observations for human review, not a diagnosis. Timing alone does not establish cause."
    return {"answer": answer, "mode": "Local evidence fallback", "evidence": evidence[:5000]}
