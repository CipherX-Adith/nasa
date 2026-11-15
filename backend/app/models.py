from datetime import date, datetime, timezone
from sqlalchemy import String, Float, DateTime, Boolean, ForeignKey, Text, Integer, Date as SQLDate, UniqueConstraint
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
    flight_clearance: Mapped[str | None] = mapped_column(String, nullable=True, default="UNREVIEWED")
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)

class ReferenceDataset(Base):
    __tablename__ = "reference_datasets"
    id: Mapped[int] = mapped_column(primary_key=True)
    accession: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    citation: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String)
    sha256: Mapped[str] = mapped_column(String)
    loaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class ReferenceSubject(Base):
    __tablename__ = "reference_subjects"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String, index=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("reference_datasets.id"), index=True)
    label: Mapped[str] = mapped_column(String)

class LabResult(Base):
    __tablename__ = "lab_results"
    __table_args__ = (UniqueConstraint("accession", "row_hash", name="uq_lab_result_source_row"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("reference_datasets.id"), index=True)
    subject_code: Mapped[str] = mapped_column(String, index=True)
    analyte: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String)
    ref_low: Mapped[float | None] = mapped_column(Float, nullable=True)
    ref_high: Mapped[float | None] = mapped_column(Float, nullable=True)
    timepoint_label: Mapped[str] = mapped_column(String)
    days_from_launch: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    accession: Mapped[str] = mapped_column(String, index=True)
    source_file: Mapped[str] = mapped_column(String)
    row_hash: Mapped[str] = mapped_column(String)

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
    status: Mapped[str] = mapped_column(String, default="Pending clinician review")
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)
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
    extraction_method: Mapped[str] = mapped_column(String, default="text")
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)

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
    review_status: Mapped[str] = mapped_column(String, default="pending_review")
    reviewed_by: Mapped[str] = mapped_column(String, default="")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[str] = mapped_column(Text, default="")

class CountermeasureCheck(Base):
    __tablename__ = "countermeasure_checks"
    __table_args__ = (UniqueConstraint("astronaut_id", "protocol_key", "session_date", name="uq_countermeasure_daily"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    astronaut_id: Mapped[int] = mapped_column(ForeignKey("astronauts.id"), index=True)
    protocol_key: Mapped[str] = mapped_column(String, index=True)
    session_date: Mapped[date] = mapped_column(SQLDate, index=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    session_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    session_note: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String, default="Astronaut self-report")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    actor_username: Mapped[str] = mapped_column(String, index=True)
    action: Mapped[str] = mapped_column(String, index=True)
    entity_type: Mapped[str] = mapped_column(String, index=True)
    entity_id: Mapped[str] = mapped_column(String)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
