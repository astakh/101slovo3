"""
101slovo — Точка входа FastAPI-приложения.
Lifespan, middleware, роутеры.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.pool import init_pool, close_pool
from app.core.exceptions import register_exception_handlers

# Роутеры v1
from app.api.v1 import auth, lessons, dashboard, onboarding, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Жизненный цикл приложения.
    Startup: инициализация пула БД.
    Shutdown: закрытие пула.
    """
    # ── Startup ──────────────────────────────────────────────────────
    await init_pool()
    yield
    # ── Shutdown ─────────────────────────────────────────────────────
    await close_pool()


app = FastAPI(
    title="101slovo API",
    description="MVP backend — интервальное повторение английских слов в контексте",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS Middleware ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,  # Обязательно для httpOnly cookie / Authorization header
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Exception Handlers ───────────────────────────────────────────────
register_exception_handlers(app)

# ─── Routers ──────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding"])
app.include_router(lessons.router, prefix="/lessons", tags=["Lessons"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])


# ─── Health Check ─────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """Проверка работоспособности сервиса."""
    return {"status": "ok"}
