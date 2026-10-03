"""
101slovo — Pydantic-схемы для онбординга.
"""

from typing import Literal

from pydantic import BaseModel


class OnboardingRequest(BaseModel):
    """Схема для завершения онбординга."""
    timezone: str
    level: Literal["A1", "A2", "B1", "B2"]
    dictionary_id: int


class OnboardingResponse(BaseModel):
    """Ответ после завершения онбординга."""
    status: str = "ok"


class DictionaryResponse(BaseModel):
    """Схема словаря."""
    id: int
    code: str
    name: str
    description: str | None = None
