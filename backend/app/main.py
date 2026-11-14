import os, re
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field
from .db import Base, engine, get_db
from .models import User, Astronaut, Measurement, Alert, Assessment, MedicalDocument, MedicalObservation
from .core import verify_password, make_token, read_token
from .intelligence import baseline, detect
from .seed import seed

app=FastAPI(title="ORBITCARE AI",version="1.0.0")
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
Base.metadata.create_all(bind=engine)
with next(get_db()) as db: seed(db)

def current_user(authorization: str|None=Header(default=None),db:Session=Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "): raise HTTPException(401,"Sign in required")
    payload=read_token(authorization[7:]); user=db.query(User).filter_by(username=(payload or {}).get("sub")).first() if payload else None
    if not user: raise HTTPException(401,"Invalid session")
    return user
def medical(user=Depends(current_user)):
    if user.role!="medical": raise HTTPException(403,"Medical officer access required")
    return user
def allowed(user, astronaut_id):
    if user.role!="medical" and user.astronaut_id!=astronaut_id: raise HTTPException(403,"You can only access your own records")
def serialize(row): return {c.name:getattr(row,c.name) for c in row.__table__.columns}
def refresh_alerts(db):
    existing={a.measurement_id for a in db.query(Alert).all()}
    for item in detect(db.query(Measurement).order_by(Measurement.timestamp).all()):
        if item["measurement_id"] not in existing:
            db.add(Alert(astronaut_id=item["astronaut_id"],measurement_id=item["measurement_id"],metric=item["metric"],priority=item["priority"],reason=item["reason"]))
    db.commit()

class Login(BaseModel): username:str; password:str
class AssessmentIn(BaseModel): sleep_hours:float=Field(ge=0,le=24); sleep_quality:int=Field(ge=1,le=10); stress:int=Field(ge=1,le=10); mood:int=Field(ge=1,le=10); fatigue:int=Field(ge=1,le=10); symptoms:str="None reported"
class Followup(BaseModel): note:str=Field(min_length=1,max_length=2000)
class Ask(BaseModel): question:str=Field(min_length=1,max_length=2000); astronaut_id:int|None=None
class MeasurementIn(BaseModel): domain:str; metric:str; value:float; unit:str; timestamp:datetime|None=None; source:str="Manual entry"; quality:str="good"

@app.get("/")
@app.get("/api")
@app.get("/api/health")
def health(): return {"status":"ok","app":"ORBITCARE AI"}
@app.post("/api/auth/login")
def login(data:Login,db:Session=Depends(get_db)):
    user=db.query(User).filter_by(username=data.username).first()
    if not user or not verify_password(data.password,user.password_hash): raise HTTPException(401,"Invalid username or password")
    return {"access_token":make_token(user.username,user.role),"role":user.role,"username":user.username,"astronaut_id":user.astronaut_id}
@app.get("/api/auth/me")
def me(user=Depends(current_user)): return {"username":user.username,"role":user.role,"astronaut_id":user.astronaut_id}
@app.get("/api/astronauts")
def astronauts(db:Session=Depends(get_db),user=Depends(current_user)):
    if user.role=="medical": return [serialize(x) for x in db.query(Astronaut).all()]
    return [serialize(db.get(Astronaut,user.astronaut_id) )]
@app.post("/api/astronauts")
def create_astronaut(data:dict,db:Session=Depends(get_db),user=Depends(medical)):
    a=Astronaut(name=data["name"],call_sign=data["call_sign"],mission=data.get("mission","Asteria-7"));db.add(a);db.commit();db.refresh(a);return serialize(a)
@app.get("/api/astronauts/{aid}/measurements")
def measurements(aid:int,metric:str|None=None,db:Session=Depends(get_db),user=Depends(current_user)):
    allowed(user,aid);q=db.query(Measurement).filter_by(astronaut_id=aid)
    if metric:q=q.filter_by(metric=metric)
    return [serialize(x) for x in q.order_by(Measurement.timestamp).all()]
@app.post("/api/astronauts/{aid}/measurements")
def add_measurement(aid:int,data:MeasurementIn,db:Session=Depends(get_db),user=Depends(medical)):
    if not db.get(Astronaut,aid):raise HTTPException(404,"Astronaut not found")
    x=Measurement(astronaut_id=aid,**data.model_dump(exclude={"timestamp"}),timestamp=data.timestamp or datetime.now(timezone.utc),simulated=False);db.add(x);db.commit();db.refresh(x);refresh_alerts(db);return serialize(x)
@app.get("/api/astronauts/{aid}/baselines")
def baselines(aid:int,db:Session=Depends(get_db),user=Depends(current_user)):
    allowed(user,aid); rows=db.query(Measurement).filter_by(astronaut_id=aid).all(); groups={}
    for r in rows:groups.setdefault((r.metric,r.unit,r.domain),[]).append(r)
    return [{"metric":m,"unit":u,"domain":d,**baseline([x.value for x in rs])} for (m,u,d),rs in groups.items()]
@app.get("/api/astronauts/{aid}/assessments")
def assessments(aid:int,db:Session=Depends(get_db),user=Depends(current_user)):
    allowed(user,aid);return [serialize(x) for x in db.query(Assessment).filter_by(astronaut_id=aid).order_by(Assessment.timestamp).all()]
@app.post("/api/astronauts/{aid}/assessments")
def add_assessment(aid:int,data:AssessmentIn,db:Session=Depends(get_db),user=Depends(current_user)):
    allowed(user,aid);x=Assessment(astronaut_id=aid,**data.model_dump());db.add(x);db.commit();db.refresh(x);return serialize(x)
@app.get("/api/alerts")
def alerts(astronaut_id:int|None=None,db:Session=Depends(get_db),user=Depends(current_user)):
    refresh_alerts(db);q=db.query(Alert)
    if user.role!="medical":q=q.filter_by(astronaut_id=user.astronaut_id)
    elif astronaut_id:q=q.filter_by(astronaut_id=astronaut_id)
    return [serialize(x) for x in q.order_by(desc(Alert.created_at)).all()]
@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge(alert_id:int,data:Followup,db:Session=Depends(get_db),user=Depends(medical)):
    a=db.get(Alert,alert_id)
    if not a:raise HTTPException(404,"Alert not found")
    a.acknowledged=True;a.acknowledged_by=user.username;a.follow_up=data.note;db.commit();return serialize(a)
@app.get("/api/astronauts/{aid}/documents")
def documents(aid:int,db:Session=Depends(get_db),user=Depends(current_user)):
    allowed(user,aid);return [{**serialize(x),"observations":[serialize(o) for o in db.query(MedicalObservation).filter_by(document_id=x.id).all()]} for x in db.query(MedicalDocument).filter_by(astronaut_id=aid).order_by(desc(MedicalDocument.uploaded_at)).all()]
@app.post("/api/astronauts/{aid}/documents")
async def upload_document(aid:int,file:UploadFile=File(...),db:Session=Depends(get_db),user=Depends(medical)):
    if not file.filename.lower().endswith(".pdf"):raise HTTPException(400,"Upload a PDF report")
    content=await file.read()
    try:
        try:
            import pypdf, io
            reader = pypdf.PdfReader(io.BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
    except Exception as e: raise HTTPException(400, f"Could not read PDF: {e}")
    if not text.strip(): text="No selectable text found. OCR was not available; values require manual review."
    report=MedicalDocument(astronaut_id=aid,filename=file.filename,extracted_text=text[:50000],confidence=.82 if len(text)>30 else .25)
    db.add(report);db.flush()
    # Surface candidate table-like values for human review. Parsing is intentionally conservative.
    for line in text.splitlines():
        match=re.match(r"\s*([A-Za-z][A-Za-z0-9 /()-]{1,50}?)\s{1,}(\d+(?:\.\d+)?)\s*([A-Za-z/%µμ^0-9.-]{0,16})\s*(?:\((?:ref(?:erence)?\s*)?([^)]{1,30})\))?\s*$",line,re.I)
        if match:
            db.add(MedicalObservation(document_id=report.id,test_name=match.group(1).strip(),result=match.group(2),unit=match.group(3).strip(),reference_range=(match.group(4) or "Unknown").strip(),confidence=.55 if len(text)>30 else .25))
    db.commit();db.refresh(report);return {**serialize(report),"observations":[serialize(o) for o in db.query(MedicalObservation).filter_by(document_id=report.id).all()]}
@app.post("/api/documents/{doc_id}/verify")
def verify_document(doc_id:int,db:Session=Depends(get_db),user=Depends(medical)):
    d=db.get(MedicalDocument,doc_id)
    if not d:raise HTTPException(404,"Document not found")
    d.verified=True;d.confidence=1;db.commit();return serialize(d)
@app.get("/api/documents/{doc_id}/observations")
def document_observations(doc_id:int,db:Session=Depends(get_db),user=Depends(current_user)):
    d=db.get(MedicalDocument,doc_id)
    if not d:raise HTTPException(404,"Document not found")
    allowed(user,d.astronaut_id)
    return [serialize(o) for o in db.query(MedicalObservation).filter_by(document_id=doc_id).all()]
@app.post("/api/observations/{observation_id}/verify")
def verify_observation(observation_id:int,db:Session=Depends(get_db),user=Depends(medical)):
    o=db.get(MedicalObservation,observation_id)
    if not o:raise HTTPException(404,"Observation not found")
    o.verified=True;o.confidence=1;db.commit();return serialize(o)
@app.get("/api/timeline/{aid}")
def timeline(aid:int,db:Session=Depends(get_db),user=Depends(current_user)):
    allowed(user,aid);events=[]
    for x in db.query(Measurement).filter_by(astronaut_id=aid).all():events.append({"id":f"m{x.id}","timestamp":x.timestamp,"type":"measurement","title":x.metric,"detail":f"{x.value} {x.unit} · {x.source}","simulated":x.simulated})
    for x in db.query(Assessment).filter_by(astronaut_id=aid).all():events.append({"id":f"a{x.id}","timestamp":x.timestamp,"type":"assessment","title":"Daily health assessment","detail":f"Sleep {x.sleep_hours}h · Fatigue {x.fatigue}/10 · Stress {x.stress}/10","simulated":x.simulated})
    for x in db.query(Alert).filter_by(astronaut_id=aid).all():events.append({"id":f"l{x.id}","timestamp":x.created_at,"type":"alert","title":f"{x.priority.title()} alert: {x.metric}","detail":x.reason,"simulated":True})
    for x in db.query(MedicalDocument).filter_by(astronaut_id=aid).all():events.append({"id":f"d{x.id}","timestamp":x.uploaded_at,"type":"document","title":f"Report uploaded: {x.filename}","detail":"Verified" if x.verified else "Extracted observations pending human review","simulated":False})
    return sorted(events,key=lambda x:x["timestamp"],reverse=True)
@app.post("/api/assistant/ask")
def ask(data:Ask,db:Session=Depends(get_db),user=Depends(current_user)):
    aid=data.astronaut_id or user.astronaut_id
    if not aid:raise HTTPException(400,"Select an astronaut")
    allowed(user,aid)
    rows=db.query(Measurement).filter_by(astronaut_id=aid).order_by(desc(Measurement.timestamp)).limit(80).all()
    als=db.query(Alert).filter_by(astronaut_id=aid).order_by(desc(Alert.created_at)).limit(15).all()
    docs=db.query(MedicalDocument).filter_by(astronaut_id=aid).order_by(desc(MedicalDocument.uploaded_at)).limit(5).all()
    evidence="\n".join([f"{r.metric}: {r.value} {r.unit} at {r.timestamp} ({r.source})" for r in rows[:30]]+[f"Alert {a.priority}: {a.reason}" for a in als]+[f"Report {d.filename}: {d.extracted_text[:800]}" for d in docs]) or "No health records available."
    key=os.getenv("GEMINI_API_KEY")
    if key:
        try:
            import httpx
            prompt=f"You are a cautious astronaut health information assistant, not a clinician. Answer only from the evidence below; distinguish observations from interpretation; cite evidence; state what is missing. Do not diagnose, recommend treatment, or infer causation.\nEVIDENCE:\n{evidence}\nQUESTION: {data.question}"
            resp=httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=25.0
            )
            if resp.status_code == 200:
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                return {"answer":text,"mode":"Gemini grounded","evidence":evidence[:5000]}
        except Exception: pass
    facts=[]
    for metric in re.findall(r"heart rate|HRV|sleep duration|fatigue|temperature|body mass|CO2|radiation",data.question,re.I):
        candidates=[r for r in rows if metric.lower() in r.metric.lower()]
        if candidates:facts.extend([f"Observed {r.metric}: {r.value} {r.unit} at {r.timestamp} (source: {r.source})." for r in candidates[:4]])
    facts.extend([f"Alert: {a.reason}" for a in als[:4]])
    answer="Evidence retrieved from available project records:\n- "+"\n- ".join(facts[:8]) if facts else "I could not find a specific matching measurement in the available records. Please specify a metric or astronaut. The Gemini service is not configured, so this response uses the local evidence fallback."
    answer+="\n\nThese are observations for human review, not a diagnosis. Timing alone does not establish cause."
    return {"answer":answer,"mode":"Local evidence fallback","evidence":evidence[:5000]}
