"""
101slovo — Роутер онбординга.
Завершение онбординга, получение списка словарей.
"""

import json
import zoneinfo

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import AsyncConnection

from app.api.deps import get_current_user_id, get_db
from app.config import settings
from app.schemas.onboarding import DictionaryResponse, OnboardingRequest, OnboardingResponse

router = APIRouter()


@router.post("/complete", response_model=OnboardingResponse)
async def complete_onboarding(
    req: OnboardingRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Завершение онбординга.
    
    - Валидирует часовой пояс
    - Создаёт профиль обучения
    - Привязывает пользователя к словарю по умолчанию
    - Логирует событие onboarding_completed
    """
    # 1. Валидация часового пояса
    if req.timezone not in zoneinfo.available_timezones():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invalid_timezone",
        )

    async with db.transaction():
        # 2. Проверка статуса пользователя
        cur = await db.execute(
            "SELECT is_onboarded FROM users WHERE id = %s",
            [user_id],
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="user_not_found",
            )
        if user["is_onboarded"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="already_onboarded",
            )

        # 3. Проверка наличия словаря по умолчанию
        cur_dict = await db.execute(
            "SELECT id FROM dictionaries WHERE code = %s",
            [settings.DEFAULT_DICTIONARY_CODE],
        )
        dict_row = cur_dict.fetchone()
        if not dict_row:
            # Критическая ошибка: словарь по умолчанию не найден
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="default_dictionary_missing",
            )

        # 4. Обновление пользователя
        await db.execute(
            """UPDATE users 
               SET timezone = %s, is_onboarded = true, updated_at = now() 
               WHERE id = %s""",
            [req.timezone, user_id],
        )

        # 5. Создание профиля обучения
        await db.execute(
            """INSERT INTO learning_profiles 
               (user_id, level, dictionary_id, daily_lesson_limit, words_per_lesson) 
               VALUES (%s, %s, %s, %s, %s)""",
            [
                user_id,
                req.level,
                dict_row["id"],
                settings.DAILY_LESSON_LIMIT_DEFAULT,
                settings.WORDS_PER_LESSON_DEFAULT,
            ],
        )

        # 6. Логирование события
        await db.execute(
            "INSERT INTO events (user_id, type, payload) VALUES (%s, %s, %s)",
            [
                user_id,
                "onboarding_completed",
                json.dumps({"level": req.level, "timezone": req.timezone}),
            ],
        )

    return OnboardingResponse(status="ok")


@router.get("/dictionaries", response_model=list[DictionaryResponse])
async def get_dictionaries(
    db: AsyncConnection = Depends(get_db),
):
    """
    Получение списка доступных словарей.
    Используется на этапе онбординга для выбора словаря.
    """
    cur = await db.execute(
        "SELECT id, code, name, description FROM dictionaries ORDER BY name"
    )
    rows = cur.fetchall()
    return [DictionaryResponse(**row) for row in rows]
