"""
101slovo — Onboarding router (заглушка для Задачи 3).
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/ping")
async def ping():
    return {"status": "ok", "router": "onboarding"}
