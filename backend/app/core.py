import os
import secrets
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
if not SECRET_KEY or SECRET_KEY.lower() in {"change-me-for-local-use", "local-demo-secret-change-me"}:
    SECRET_KEY = "orbitcare-spaceflight-operations-secure-key-2026"
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
    return jwt.encode({"sub": username, "role": role, "exp": datetime.now(timezone.utc)+timedelta(hours=12)}, SECRET_KEY, algorithm=ALGORITHM)
def read_token(token: str):
    try: return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError: return None
