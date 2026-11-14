import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# On Vercel, the file system is read-only except for /tmp
default_sqlite = "sqlite:////tmp/orbitcare.db" if os.getenv("VERCEL") else "sqlite:///./orbitcare.db"
DATABASE_URL = os.getenv("DATABASE_URL", default_sqlite)
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
class Base(DeclarativeBase): pass
def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()
