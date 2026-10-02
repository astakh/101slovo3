"""
101slovo — Роутер уроков.
Preview (подбор слов), Decline (отказ от слова) и Start (старт урока).
"""

import json

from fastapi import APIRouter, Depends, Header, HTTPException, status
from psycopg import AsyncConnection
from pydantic import BaseModel

from app.api.deps import get_current_user_id, get_db
from app.schemas.lesson_start import LessonStartRequest, LessonStartResponse
from app.services.lesson_preview import get_preview_data
from app.services.lesson_start import start_lesson

router = APIRouter()


class DeclineWordRequest(BaseModel):
    word_id: int


@router.post("/preview")
async def lesson_preview(
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Подбор слов для следующего урока (алгоритм 5.2).
    
    Возвращает:
    - state: "resume" | "limit_reached" | "no_words" | "ready"
    - due_words: слова для повторения
    - new_words: новые слова для изучения
    - dictionary_exhausted: флаг исчерпания словаря
    """
    # Проверяем онбординг и получаем профиль
    cur = await db.execute(
        """SELECT u.is_onboarded, lp.id as profile_id 
           FROM users u 
           LEFT JOIN learning_profiles lp ON lp.user_id = u.id 
           WHERE u.id = %s""",
        [user_id],
    )
    row = cur.fetchone()
    if not row or not row["is_onboarded"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="onboarding_required",
        )
    if not row["profile_id"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="onboarding_required",
        )

    result = await get_preview_data(db, row["profile_id"])
    return result


@router.post("/new-word/decline")
async def decline_new_word(
    req: DeclineWordRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Отказ от нового слова (алгоритм 5.3).
    
    Помечает слово как ignored, чтобы оно не предлагалось в будущем.
    Идемпотентный: повторный вызов возвращает успех.
    
    После отказа пересчитывает preview и возвращает обновлённый набор слов.
    """
    # 1. Проверяем онбординг
    cur = await db.execute(
        """SELECT u.is_onboarded, lp.id as profile_id, lp.dictionary_id 
           FROM users u 
           LEFT JOIN learning_profiles lp ON lp.user_id = u.id 
           WHERE u.id = %s""",
        [user_id],
    )
    row = cur.fetchone()
    if not row or not row["is_onboarded"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="onboarding_required",
        )
    profile_id = row["profile_id"]
    dictionary_id = row["dictionary_id"]

    # 2. Проверяем, нет незавершённого урока
    cur = await db.execute(
        """SELECT id FROM lessons 
           WHERE learning_profile_id = %s AND status = 'in_progress'""",
        [profile_id],
    )
    if cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="lesson_in_progress",
        )

    # 3. Проверяем, что слово входит в активный словарь
    cur = await db.execute(
        """SELECT id FROM words 
           WHERE id = %s AND %s = ANY(dictionary_ids)""",
        [req.word_id, dictionary_id],
    )
    if not cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="word_not_in_dictionary",
        )

    # 4. Проверяем статус в user_words
    cur = await db.execute(
        """SELECT status FROM user_words 
           WHERE learning_profile_id = %s AND word_id = %s""",
        [profile_id, req.word_id],
    )
    existing = cur.fetchone()

    if existing:
        if existing["status"] == "ignored":
            # Идемпотентный успех
            return await get_preview_data(db, profile_id)
        elif existing["status"] in ("active", "mastered"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="word_already_in_vocabulary",
            )

    # 5. Вставляем как ignored
    async with db.transaction():
        await db.execute(
            """INSERT INTO user_words (learning_profile_id, word_id, status, stage, due_lesson_number, source)
               VALUES (%s, %s, 'ignored', 0, NULL, 'decline')
               ON CONFLICT (learning_profile_id, word_id) DO NOTHING""",
            [profile_id, req.word_id],
        )

        # 6. Событие
        await db.execute(
            "INSERT INTO events (user_id, type, payload) VALUES (%s, %s, %s)",
            [user_id, "new_word_declined", json.dumps({"word_id": req.word_id})],
        )

    # 7. Пересчитываем preview
    return await get_preview_data(db, profile_id)


@router.post("/start", response_model=LessonStartResponse)
async def lesson_start(
    req: LessonStartRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
    idempotency_key: str = Header(alias="Idempotency-Key"),
):
    """
    Старт урока (алгоритм 5.4).
    
    Этапы:
    1. Валидация идемпотентности через Idempotency-Key
    2. Предпроверки (онбординг, in_progress, лимит)
    3. Advisory lock для предотвращения параллельного старта
    4. Сверка состава слов с preview
    5. Кластеризация слов в группы
    6-8. Генерация предложений через LLM с валидацией и повторами
    9. Финальная транзакция записи урока и упражнений
    10. Возврат информации о созданном уроке
    
    Идемпотентность: повторный запрос с тем же Idempotency-Key возвращает существующий урок.
    """
    # Проверяем онбординг и получаем профиль
    cur = await db.execute(
        """SELECT u.is_onboarded, lp.id as profile_id 
           FROM users u 
           LEFT JOIN learning_profiles lp ON lp.user_id = u.id 
           WHERE u.id = %s""",
        [user_id],
    )
    row = cur.fetchone()
    if not row or not row["is_onboarded"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="onboarding_required",
        )
    if not row["profile_id"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="onboarding_required",
        )

    try:
        result = await start_lesson(
            db,
            user_id=user_id,
            profile_id=row["profile_id"],
            word_ids=req.word_ids,
            idempotency_key=idempotency_key,
        )
        return result
    except ValueError as e:
        error_code = str(e)
        status_map = {
            "invalid_idempotency_key": (422, "invalid_idempotency_key"),
            "lesson_completed": (409, "lesson_completed"),
            "resume_available": (409, "resume_available"),
            "limit_reached": (409, "limit_reached"),
            "start_in_progress": (409, "start_in_progress"),
            "preview_outdated": (409, "preview_outdated"),
            "words_changed": (409, "preview_outdated"),
            "idempotency_key_taken": (409, "start_in_progress"),
            "profile_not_found": (404, "profile_not_found"),
        }
        http_status, code = status_map.get(error_code, (400, error_code))
        raise HTTPException(status_code=http_status, detail=code)
