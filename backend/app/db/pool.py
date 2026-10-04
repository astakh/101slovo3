"""
101slovo — Пул подключений к PostgreSQL (psycopg 3, async).
Управление жизненным циклом через lifespan FastAPI.
"""

from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row

from app.config import settings

# Глобальный пул соединений
pool: AsyncConnectionPool | None = None


async def init_pool() -> None:
    """
    Инициализация пула подключений.
    Вызывается в lifespan при старте приложения.
    """
    global pool
    pool = AsyncConnectionPool(
        conninfo=settings.DATABASE_URL,
        open=False,  # Откроем вручную в lifespan
        min_size=2,
        max_size=10,
        kwargs={
            "row_factory": dict_row,  # Строки как dict
            "autocommit": False,  # Транзакции управляем вручную
        },
    )
    await pool.open()


async def close_pool() -> None:
    """
    Закрытие пула подключений.
    Вызывается в lifespan при остановке приложения.
    """
    global pool
    if pool:
        await pool.close()
        pool = None


def get_pool() -> AsyncConnectionPool:
    """Получить пул (для использования в зависимостях)."""
    if pool is None:
        raise RuntimeError("Connection pool is not initialized")
    return pool
