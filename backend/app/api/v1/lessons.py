"""
101slovo — Роутер уроков.
Preview, Decline, Start, Evaluate, Suggestions, Report.
"""

import json
import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from psycopg import AsyncConnection
from pydantic import BaseModel

from app.api.deps import get_current_user_id, get_db
from app.core.rate_limit import limiter
from app.schemas.lesson_start import LessonStartRequest, LessonStartResponse
from app.services.lesson_evaluate import _build_saved_result, evaluate_exercise
from app.services.lesson_preview import get_preview_data
from app.services.lesson_start import start_lesson

logger = logging.getLogger(__name__)
router = APIRouter()


class DeclineWordRequest(BaseModel):
    word_id: int


class EvaluateRequest(BaseModel):
    exercise_id: int
    user_translation: Optional[str] = None
    dont_know: bool = False


class SuggestionActionRequest(BaseModel):
    action: Literal["add", "ignore"]


class ReportRequest(BaseModel):
    reason: Literal["bad_sentence", "wrong_translation", "grammar_error", "other"]
    comment: Optional[str] = None


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
    logger.info(f"🔍 Preview: user_id={user_id}")
    cur = await db.execute(
        """SELECT u.is_onboarded, lp.id as profile_id 
           FROM users u 
           LEFT JOIN learning_profiles lp ON lp.user_id = u.id 
           WHERE u.id = %s""",
        [user_id],
    )
    row = await cur.fetchone()
    logger.info(f"📊 Preview: row={row}")
    
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
    logger.info(f"✅ Preview: state={result.get('state')}")
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
    row = await cur.fetchone()
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
    if await cur.fetchone():
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
    if not await cur.fetchone():
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
    existing = await cur.fetchone()

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
    row = await cur.fetchone()
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


@router.post("/evaluate")
async def lesson_evaluate(
    req: EvaluateRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Оценка упражнения (алгоритм 5.5).
    
    - Вызов LLM для оценки перевода
    - Ветка «Не знаю» без вызова LLM
    - Обновление SRS (stage, due_lesson_number)
    - Автозавершение урока при последнем упражнении
    - Подсказки новых слов
    """
    print("=" * 80)
    print("🔍 EVALUATE ENDPOINT CALLED")
    print("=" * 80)
    print(f"User ID: {user_id}")
    print(f"Request: {req}")
    print(f"Exercise ID: {req.exercise_id}")
    print(f"User Translation: {req.user_translation}")
    print(f"Don't Know: {req.dont_know}")
    print("=" * 80)
    
    # Rate limit
    limiter.check_evaluate_limit(user_id)

    # Получаем профиль
    cur = await db.execute(
        "SELECT id FROM learning_profiles WHERE user_id = %s", [user_id]
    )
    profile = await cur.fetchone()
    
    print(f"📊 Profile: {profile}")
    
    if not profile:
        print("❌ Profile not found")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="onboarding_required",
        )

    try:
        print("🚀 Calling evaluate_exercise...")
        result = await evaluate_exercise(
            db,
            user_id=user_id,
            profile_id=profile["id"],
            exercise_id=req.exercise_id,
            user_translation=req.user_translation,
            dont_know=req.dont_know,
        )
        print("✅ evaluate_exercise completed successfully")
        print(f"Result: {result}")
        return result
    except ValueError as e:
        error_code = str(e)
        print(f"❌ ValueError: {error_code}")
        status_map = {
            "exercise_not_found": (404, "exercise_not_found"),
            "lesson_not_active": (409, "lesson_not_active"),
            "not_current_exercise": (409, "not_current_exercise"),
            "invalid_input": (422, "invalid_input"),
            "llm_refused": (422, "llm_refused"),
            "llm_unavailable": (503, "llm_unavailable"),
            "llm_invalid_response": (503, "llm_invalid_response"),
        }
        http_status, code = status_map.get(error_code, (400, error_code))
        print(f"❌ Raising HTTP {http_status}: {code}")
        raise HTTPException(status_code=http_status, detail=code)
    except Exception as e:
        print(f"❌ Unexpected error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"unexpected_error: {str(e)}"
        )


@router.get("/{lesson_id}/exercises/{exercise_id}/result")
async def get_exercise_result(
    lesson_id: int,
    exercise_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Возвращает сохранённый результат упражнения (идемпотентность).
    """
    # Проверяем принадлежность
    cur = await db.execute(
        """SELECT le.id FROM lesson_exercises le
           JOIN lessons l ON l.id = le.lesson_id
           JOIN learning_profiles lp ON lp.id = l.learning_profile_id
           WHERE le.id = %s AND le.lesson_id = %s AND lp.user_id = %s""",
        [exercise_id, lesson_id, user_id],
    )
    if not await cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="exercise_not_found",
        )

    try:
        return await _build_saved_result(db, exercise_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="exercise_not_found",
        )


@router.post("/exercises/{exercise_id}/suggestions/{word_id}")
async def handle_suggestion(
    exercise_id: int,
    word_id: int,
    req: SuggestionActionRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Обработка подсказки: добавить или игнорировать.
    
    - add: добавляет слово в user_words со status='active'
    - ignore: добавляет слово в user_words со status='ignored'
    """
    # Получаем профиль и упражнение
    cur = await db.execute(
        """SELECT lp.id as profile_id, le.id, le.suggested_words, le.lesson_id, l.lesson_number
           FROM lesson_exercises le
           JOIN lessons l ON l.id = le.lesson_id
           JOIN learning_profiles lp ON lp.id = l.learning_profile_id
           WHERE le.id = %s AND lp.user_id = %s""",
        [exercise_id, user_id],
    )
    row = await cur.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="exercise_not_found",
        )

    profile_id = row["profile_id"]
    suggested_words = row["suggested_words"]
    lesson_number = row["lesson_number"]

    # Проверяем что подсказка существует
    suggestion_exists = any(sw["word_id"] == word_id for sw in suggested_words)
    if not suggestion_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="suggestion_not_found",
        )

    async with db.transaction():
        # Проверяем текущее состояние в user_words
        cur = await db.execute(
            "SELECT id, status FROM user_words WHERE learning_profile_id = %s AND word_id = %s",
            [profile_id, word_id],
        )
        existing = await cur.fetchone()

        if req.action == "add":
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="already_in_vocabulary",
                )

            await db.execute(
                """INSERT INTO user_words 
                   (learning_profile_id, word_id, status, stage, due_lesson_number, source)
                   VALUES (%s, %s, 'active', 0, %s, 'suggestion')""",
                [profile_id, word_id, lesson_number + 1],
            )
            new_state = "added"

            await db.execute(
                "INSERT INTO events (user_id, type, payload) VALUES (%s, %s, %s)",
                [user_id, "new_word_accepted", json.dumps({"word_id": word_id})],
            )

        elif req.action == "ignore":
            if not existing:
                await db.execute(
                    """INSERT INTO user_words 
                       (learning_profile_id, word_id, status, stage, due_lesson_number, source)
                       VALUES (%s, %s, 'ignored', 0, NULL, 'decline')""",
                    [profile_id, word_id],
                )
            new_state = "ignored"

            await db.execute(
                "INSERT INTO events (user_id, type, payload) VALUES (%s, %s, %s)",
                [user_id, "new_word_declined", json.dumps({"word_id": word_id})],
            )

        # Обновляем suggested_words
        updated_suggestions = []
        for sw in suggested_words:
            if sw["word_id"] == word_id:
                updated_suggestions.append({"word_id": word_id, "state": new_state})
            else:
                updated_suggestions.append(sw)

        await db.execute(
            "UPDATE lesson_exercises SET suggested_words = %s WHERE id = %s",
            [json.dumps(updated_suggestions, ensure_ascii=False), exercise_id],
        )

    return {"status": "ok", "word_id": word_id, "state": new_state}


@router.post("/exercises/{exercise_id}/report")
async def report_exercise(
    exercise_id: int,
    req: ReportRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Жалоба на предложение.
    
    - Rate limit: 20 жалоб в час
    - Валидация комментария (до 500 символов)
    - Upsert жалобы (одна жалоба на упражнение)
    """
    # Rate limit
    limiter.check_report_limit(user_id)

    # Проверяем валидность комментария
    if req.comment and len(req.comment) > 500:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="comment_too_long",
        )

    # Проверяем принадлежность упражнения
    cur = await db.execute(
        """SELECT le.id FROM lesson_exercises le
           JOIN lessons l ON l.id = le.lesson_id
           JOIN learning_profiles lp ON lp.id = l.learning_profile_id
           WHERE le.id = %s AND lp.user_id = %s""",
        [exercise_id, user_id],
    )
    if not await cur.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="exercise_not_found",
        )

    async with db.transaction():
        # Upsert жалобы
        await db.execute(
            """INSERT INTO sentence_reports (user_id, exercise_id, reason, comment, status)
               VALUES (%s, %s, %s, %s, 'new')
               ON CONFLICT (user_id, exercise_id) 
               DO UPDATE SET reason = EXCLUDED.reason, comment = EXCLUDED.comment, updated_at = now()""",
            [user_id, exercise_id, req.reason, req.comment],
        )

        # Событие
        await db.execute(
            "INSERT INTO events (user_id, type, payload) VALUES (%s, %s, %s)",
            [
                user_id,
                "report_sent",
                json.dumps({"exercise_id": exercise_id, "reason": req.reason}),
            ],
        )

    return {"status": "ok"}


@router.get("/{lesson_id}/summary")
async def lesson_summary(
    lesson_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Итоги завершённого урока.
    
    Возвращает метрики урока и стрик.
    """
    from app.services.lesson_summary import get_lesson_summary

    # Получаем профиль
    cur = await db.execute(
        "SELECT id FROM learning_profiles WHERE user_id = %s", [user_id]
    )
    profile = await cur.fetchone()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="onboarding_required",
        )

    try:
        return await get_lesson_summary(
            db, user_id=user_id, profile_id=profile["id"], lesson_id=lesson_id
        )
    except ValueError as e:
        error_code = str(e)
        status_map = {
            "lesson_not_found": (404, "lesson_not_found"),
            "lesson_not_completed": (409, "lesson_not_completed"),
        }
        http_status, code = status_map.get(error_code, (400, error_code))
        raise HTTPException(status_code=http_status, detail=code)


@router.get("/{lesson_id}/current")
async def lesson_current(
    lesson_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
):
    """
    Текущее упражнение для возобновления урока.
    
    Возвращает первое невыполненное упражнение.
    """
    from app.services.lesson_resume import get_current_exercise

    cur = await db.execute(
        "SELECT id FROM learning_profiles WHERE user_id = %s", [user_id]
    )
    profile = await cur.fetchone()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="onboarding_required",
        )

    try:
        return await get_current_exercise(
            db, profile_id=profile["id"], lesson_id=lesson_id
        )
    except ValueError as e:
        error_code = str(e)
        status_map = {
            "lesson_not_found": (404, "lesson_not_found"),
            "lesson_not_active": (409, "lesson_not_active"),
        }
        http_status, code = status_map.get(error_code, (400, error_code))
        raise HTTPException(status_code=http_status, detail=code)
