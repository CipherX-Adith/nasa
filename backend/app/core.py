import os
import secrets
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

ORBITCARE_ENV = os.getenv("ORBITCARE_ENV", "dev").strip().lower()
if ORBITCARE_ENV not in {"dev", "demo", "prod"}:
    raise RuntimeError("ORBITCARE_ENV must be one of: dev, demo, prod")

SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
_PLACEHOLDER_KEYS = {"", "change-me-for-local-use", "local-demo-secret-change-me"}
if SECRET_KEY.lower() in _PLACEHOLDER_KEYS:
    if ORBITCARE_ENV != "dev":
        raise RuntimeError("SECRET_KEY must be set to a strong, non-placeholder value outside development")
    # Development only. Production and demo deployments must always provide a secret.
    SECRET_KEY = "orbitcare-development-only-secret-not-for-deployment"
ALGORITHM = "HS256"

try:
    import bcrypt
    def hash_password(value: str) -> str:
        return bcrypt.hashpw(value.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    def verify_password(value: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(value.encode('utf-8'), hashed.encode('utf-8'))
        except Exception:
            return False
except Exception:
    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    def hash_password(value: str) -> str: return pwd.hash(value)
    def verify_password(value: str, hashed: str) -> bool: return pwd.verify(value, hashed)

def make_token(username: str, role: str) -> str:
    return jwt.encode({"sub": username, "role": role, "exp": datetime.now(timezone.utc)+timedelta(minutes=30)}, SECRET_KEY, algorithm=ALGORITHM)
def read_token(token: str):
    try: return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError: return None
