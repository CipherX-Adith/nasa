import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext

SECRET_KEY = os.getenv("SECRET_KEY", "local-demo-secret-change-me")
ALGORITHM = "HS256"
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(value: str) -> str: return pwd.hash(value)
def verify_password(value: str, hashed: str) -> bool: return pwd.verify(value, hashed)
def make_token(username: str, role: str) -> str:
    return jwt.encode({"sub": username, "role": role, "exp": datetime.now(timezone.utc)+timedelta(hours=12)}, SECRET_KEY, algorithm=ALGORITHM)
def read_token(token: str):
    try: return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError: return None
