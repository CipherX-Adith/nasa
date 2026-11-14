import os
import threading
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

# File-backed SQLite by default for local persistence; use an external database URL in deployments.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./orbitcare.db")
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
