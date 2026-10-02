"""
101slovo — Безопасность: JWT, bcrypt, хеширование токенов.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import bcrypt
import jwt

from app.config import settings


# ─── Password hashing (bcrypt) ────────────────────────────────────────

def hash_password(password: str) -> str:
    """Хеширование пароля через bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Проверка пароля против хеша."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ─── JWT tokens ───────────────────────────────────────────────────────

def create_access_token(user_id: int) -> str:
    """Создание JWT access-токена."""
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_TTL_MIN),
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    """Декодирование и валидация access-токена."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])


# ─── Refresh tokens ───────────────────────────────────────────────────

def generate_refresh_token() -> tuple[str, str, UUID]:
    """
    Генерация refresh-токена.
    Возвращает: (raw_token, token_hash, family_id)
    """
    raw_token = secrets.token_urlsafe(48)
    token_hash = hash_refresh_token(raw_token)
    family_id = uuid4()
    return raw_token, token_hash, family_id


def hash_refresh_token(token: str) -> str:
    """SHA-256 хеш refresh-токена для хранения в БД."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_refresh_token_hash(token: str, stored_hash: str) -> bool:
    """Проверка refresh-токена против сохранённого хеша."""
    return secrets.compare_digest(hash_refresh_token(token), stored_hash)
