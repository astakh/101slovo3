"""
101slovo — Auth router (заглушка для Задачи 3).
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/ping")
async def ping():
    """Проверка доступности auth-роутера."""
    return {"status": "ok", "router": "auth"}
