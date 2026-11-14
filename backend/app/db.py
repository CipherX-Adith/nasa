import os
import threading
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

# File-backed SQLite for local development; in-memory SQLite for Vercel / serverless deployments.
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///:memory:" if os.getenv("VERCEL") else "sqlite:///./orbitcare.db"
engine_kwargs = {"connect_args": {"check_same_thread": False}} if DATABASE_URL.startswith("sqlite") else {}
if DATABASE_URL in {"sqlite://", "sqlite:///:memory:"}:
    engine_kwargs["poolclass"] = StaticPool

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
class Base(DeclarativeBase): pass

_db_lock = threading.RLock()

def get_db():
    with _db_lock:
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
