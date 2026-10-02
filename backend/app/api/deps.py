"""
101slovo — Зависимости FastAPI (Depends).
"""

from typing import AsyncGenerator

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg import AsyncConnection

from app.config import settings
from app.db.pool import get_pool


# ─── Database dependency ──────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncConnection, None]:
    """
    Зависимость для получения асинхронного соединения с БД.

    Использование:
        @router.get("/")
        async def endpoint(db: AsyncConnection = Depends(get_db)):
            ...

    Соединение автоматически возвращается в пул после выхода из контекста.
    """
    pool = get_pool()
    async with pool.connection() as conn:
        yield conn


# ─── Auth dependency ──────────────────────────────────────────────────

security = HTTPBearer()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    """
    Зависимость для извлечения user_id из access-токена.

    Использование:
        @router.get("/me")
        async def me(user_id: int = Depends(get_current_user_id)):
            ...
    """
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=["HS256"],
        )
        if payload.get("type") != "access":
            raise ValueError("Invalid token type")
        return int(payload["sub"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token",
            headers={"WWW-Authenticate": "Bearer"},
        )
