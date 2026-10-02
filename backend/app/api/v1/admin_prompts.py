"""
101slovo — Административные эндпоинты для управления промптами LLM.
"""

import re
import string
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import AsyncConnection
from pydantic import BaseModel, Field

from app.api.deps import get_current_admin_user_id, get_db
from app.services.admin_audit import log_admin_action

router = APIRouter()

# Разрешенные ключи промптов и их плейсхолдеры
ALLOWED_PLACEHOLDERS = {
    "generate_sentences": {"level"},
    "evaluate_translation": set(),
}

REQUIRED_PLACEHOLDERS = {
    "generate_sentences": {"level"},
    "evaluate_translation": set(),
}


def extract_placeholders(template: str) -> set[str]:
    """
    Извлекает имена плейсхолдеров из шаблона.
    
    Пример: "Hello {name}, you are {level}" -> {"name", "level"}
    """
    placeholders = set()
    formatter = string.Formatter()
    try:
        for _, field_name, _, _ in formatter.parse(template):
            if field_name is not None:
                # Берем только базовое имя (до . или [)
                base_name = field_name.split(".")[0].split("[")[0]
                if base_name:
                    placeholders.add(base_name)
    except ValueError:
        pass
    return placeholders


class PromptUpdateRequest(BaseModel):
    system_template: str = Field(min_length=1, max_length=8000)


@router.get("/prompts")
async def list_prompts(
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Список промптов без полного текста.
    """
    cur = await db.execute(
        "SELECT key, updated_at, updated_by FROM prompts ORDER BY key"
    )
    return cur.fetchall()


@router.get("/prompts/{key}")
async def get_prompt(
    key: str,
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Получение промпта по ключу с полным текстом.
    """
    if key not in ALLOWED_PLACEHOLDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="prompt_not_found",
        )

    cur = await db.execute(
        "SELECT key, system_template, updated_at, updated_by FROM prompts WHERE key = %s",
        [key],
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="prompt_not_found",
        )

    return {
        "key": row["key"],
        "system_template": row["system_template"],
        "required_placeholders": list(REQUIRED_PLACEHOLDERS.get(key, set())),
        "updated_at": row["updated_at"],
        "updated_by": row["updated_by"],
    }


@router.put("/prompts/{key}")
async def update_prompt(
    key: str,
    req: PromptUpdateRequest,
    admin_id: int = Depends(get_current_admin_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Обновление промпта.
    
    Валидирует плейсхолдеры:
    - Лишние плейсхолдеры запрещены
    - Обязательные плейсхолдеры должны присутствовать
    - Шаблон должен успешно рендериться с тестовыми значениями
    """
    if key not in ALLOWED_PLACEHOLDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="prompt_not_found",
        )

    template = req.system_template

    # Валидация плейсхолдеров
    placeholders = extract_placeholders(template)
    allowed = ALLOWED_PLACEHOLDERS[key]
    required = REQUIRED_PLACEHOLDERS[key]

    # Лишние плейсхолдеры
    extra = placeholders - allowed
    if extra:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"unknown_placeholder: {', '.join(extra)}",
        )

    # Отсутствие обязательных
    missing = required - placeholders
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"missing_placeholder: {', '.join(missing)}",
        )

    # Проверка рендеринга
    test_values = {name: "test_value" for name in allowed}
    if "level" in allowed:
        test_values["level"] = "A2"

    try:
        template.format_map(test_values)
    except (KeyError, ValueError, IndexError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"invalid_template: {str(e)}",
        )

    # Обновление
    async with db.transaction():
        cur = await db.execute(
            """UPDATE prompts
               SET system_template = %s, updated_at = now(), updated_by = %s
               WHERE key = %s RETURNING key""",
            [template, admin_id, key],
        )
        if not cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="prompt_not_found",
            )

        # Логируем действие
        await log_admin_action(
            db,
            admin_id=admin_id,
            action="prompt_updated",
            target_type="prompt",
            target_id=key,
            details={"length": len(template)},
        )

    return {"status": "ok", "key": key}
