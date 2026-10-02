"""
101slovo — Роутер уроков.
Preview (подбор слов) и Decline (отказ от слова).
"""

import json

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import AsyncConnection
from pydantic import BaseModel

from app.api.deps import get_current_user_id, get_db
from app.services.lesson_preview import get_preview_data

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
