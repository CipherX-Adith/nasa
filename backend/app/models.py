from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Boolean, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base

def now(): return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String) # "medical" (admin) or "astronaut"
    astronaut_id: Mapped[int | None] = mapped_column(ForeignKey("astronauts.id"), nullable=True)
    status: Mapped[str] = mapped_column(String, default="approved") # "approved", "pending_approval", "rejected"
    full_name: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    call_sign: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    mission: Mapped[str | None] = mapped_column(String, nullable=True, default="Asteria-7")
    specialization: Mapped[str | None] = mapped_column(String, nullable=True, default="Mission Specialist")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Astronaut(Base):
    __tablename__ = "astronauts"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String)
    call_sign: Mapped[str] = mapped_column(String)
    mission: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="Active")
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)

class Measurement(Base):
    __tablename__ = "measurements"
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id"), index=True)
    domain: Mapped[str] = mapped_column(String, index=True)
    metric: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    source: Mapped[str] = mapped_column(String, default="Simulated telemetry")
    quality: Mapped[str] = mapped_column(String, default="good")
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)

class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id"), index=True)
    metric: Mapped[str] = mapped_column(String)
    priority: Mapped[str] = mapped_column(String)
    reason: Mapped[str] = mapped_column(Text)
    measurement_id: Mapped[int | None] = mapped_column(ForeignKey("measurements.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    follow_up: Mapped[str] = mapped_column(Text, default="")
    acknowledged_by: Mapped[str] = mapped_column(String, default="")

class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id"), index=True)
    sleep_hours: Mapped[float] = mapped_column(Float)
    sleep_quality: Mapped[int] = mapped_column(Integer)
    stress: Mapped[int] = mapped_column(Integer)
    mood: Mapped[int] = mapped_column(Integer)
    fatigue: Mapped[int] = mapped_column(Integer)
    symptoms: Mapped[str] = mapped_column(Text, default="None reported")
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    source: Mapped[str] = mapped_column(String, default="Astronaut self-report")
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)

class MedicalRecord(Base):
    __tablename__ = "medical_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id"), index=True)
    record_type: Mapped[str] = mapped_column(String, default="Clinical Evaluation")
    title: Mapped[str] = mapped_column(String)
    physician: Mapped[str] = mapped_column(String, default="Flight Surgeon")
    findings: Mapped[str] = mapped_column(Text)
    countermeasures: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String, default="Signed & Verified")
    date: Mapped[str] = mapped_column(String, default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class MedicalDocument(Base):
    __tablename__ = "medical_documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id"), index=True)
    filename: Mapped[str] = mapped_column(String)
    report_date: Mapped[str] = mapped_column(String, default="Unknown")
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[float] = mapped_column(Float, default=.55)

class MedicalObservation(Base):
    __tablename__ = "medical_observations"
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("medical_documents.id"), index=True)
    test_name: Mapped[str] = mapped_column(String)
    result: Mapped[str] = mapped_column(String)
    unit: Mapped[str] = mapped_column(String, default="")
    reference_range: Mapped[str] = mapped_column(String, default="Unknown")
    report_date: Mapped[str] = mapped_column(String, default="Unknown")
    confidence: Mapped[float] = mapped_column(Float, default=.35)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
