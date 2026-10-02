"""
101slovo — Зависимости FastAPI (Depends).
"""

from typing import AsyncGenerator

from psycopg import AsyncConnection

from app.db.pool import get_pool


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
