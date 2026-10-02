"""
101slovo — Сервис оценки упражнения.
Алгоритм 5.5 из ТЗ: оценка перевода через LLM, ветка «Не знаю»,
валидация ответа, обновление SRS, автозавершение урока, подсказки новых слов.
"""

import json
import logging

from psycopg import AsyncConnection

from app.core.exceptions import LlmInvalidResponse, LlmRefused
from app.services.llm.helpers import evaluate_translation
from app.services.srs import srs_update
from app.utils.datetime import get_user_today
from app.utils.text_validation import (
    compute_lemma_key,
    validate_user_fragment,
    validate_user_translation,
)

logger = logging.getLogger(__name__)


async def evaluate_exercise(
    db: AsyncConnection,
    *,
    user_id: int,
    profile_id: int,
    exercise_id: int,
    user_translation: str | None = None,
    dont_know: bool = False,
) -> dict:
    """
    Алгоритм 5.5: Проверка упражнения.
    
    Этапы:
    1. Доступ и состояние
    2. Идемпотентность
    3. Порядок: только первое pending
    4. Проверка статуса урока
    5. Валидация ввода
    6. Ветка «Не знаю»
    7. Вызов LLM (Prompt 2)
    8. Валидация ответа LLM
    9. Транзакция записи
    10. Формируем ответ
    """
    # ═══════════════════════════════════════════
    # 1. Доступ и состояние
    # ═══════════════════════════════════════════
    cur = await db.execute(
        """SELECT le.id, le.lesson_id, le.order_index, le.status, le.target_sentence,
                  le.reference_translation, le.target_words, le.user_translation,
                  l.id as lesson_id, l.status as lesson_status, l.lesson_number, l.learning_profile_id
           FROM lesson_exercises le
           JOIN lessons l ON l.id = le.lesson_id
           WHERE le.id = %s""",
        [exercise_id],
    )
    exercise = cur.fetchone()
    if not exercise:
        raise ValueError("exercise_not_found")

    if exercise["learning_profile_id"] != profile_id:
        raise ValueError("exercise_not_found")  # Не раскрываем существование

    # ═══════════════════════════════════════════
    # 2. Идемпотентность
    # ═══════════════════════════════════════════
    if exercise["status"] == "evaluated":
        return await _build_saved_result(db, exercise_id)

    # ═══════════════════════════════════════════
    # 3. Порядок: только первое pending
    # ═══════════════════════════════════════════
    cur = await db.execute(
        """SELECT id FROM lesson_exercises 
           WHERE lesson_id = %s AND status = 'pending' 
           ORDER BY order_index LIMIT 1""",
        [exercise["lesson_id"]],
    )
    first_pending = cur.fetchone()
    if not first_pending or first_pending["id"] != exercise_id:
        raise ValueError("not_current_exercise")

    # ═══════════════════════════════════════════
    # 4. Проверка статуса урока
    # ═══════════════════════════════════════════
    if exercise["lesson_status"] != "in_progress":
        raise ValueError("lesson_not_active")

    # ═══════════════════════════════════════════
    # 5. Валидация ввода
    # ═══════════════════════════════════════════
    if not dont_know:
        if not user_translation:
            raise ValueError("invalid_input")
        try:
            user_translation = validate_user_translation(user_translation)
        except ValueError:
            raise ValueError("invalid_input")

    # Извлекаем целевые слова из JSONB
    target_words = exercise["target_words"]
    word_ids = [w["word_id"] for w in target_words]

    # Получаем данные слов из справочника
    cur = await db.execute(
        "SELECT id, lemma, lemma_key, pos, translations FROM words WHERE id = ANY(%s)",
        [word_ids],
    )
    words_data = {r["id"]: r for r in cur.fetchall()}

    # ═══════════════════════════════════════════
    # 6. Ветка «Не знаю»
    # ═══════════════════════════════════════════
    if dont_know:
        evaluations = []
        for tw in target_words:
            evaluations.append(
                {"word_id": tw["word_id"], "result": "incorrect", "user_fragment": None}
            )
        suggestions = []
    else:
        # ═══════════════════════════════════════════
        # 7. Вызов LLM (Prompt 2)
        # ═══════════════════════════════════════════
        llm_target_words = []
        for tw in target_words:
            wd = words_data.get(tw["word_id"])
            if wd:
                llm_target_words.append(
                    {
                        "word_id": tw["word_id"],
                        "lemma": wd["lemma"],
                        "pos": wd["pos"],
                        "surface_form": tw["surface_form"],
                        "correct_translations": wd["translations"],
                    }
                )

        try:
            llm_response = await evaluate_translation(
                db,
                target_sentence=exercise["target_sentence"],
                reference_translation=exercise["reference_translation"],
                target_words=llm_target_words,
                user_translation=user_translation,
                user_id=user_id,
                lesson_id=exercise["lesson_id"],
                exercise_id=exercise_id,
            )
        except LlmRefused:
            raise ValueError("llm_refused")
        except Exception as e:
            logger.error(f"LLM evaluation failed: {e}")
            raise ValueError("llm_unavailable")

        # ═══════════════════════════════════════════
        # 8. Валидация ответа LLM
        # ═══════════════════════════════════════════
        evaluations_raw = llm_response.get("evaluations", [])
        suggested_words_raw = llm_response.get("new_suggested_words", [])

        # Проверяем множество word_id
        response_word_ids = {e.get("word_id") for e in evaluations_raw}
        expected_word_ids = set(word_ids)
        if response_word_ids != expected_word_ids:
            raise LlmInvalidResponse("word_id mismatch")

        # Проверяем каждое слово один раз
        if len(evaluations_raw) != len(expected_word_ids):
            raise LlmInvalidResponse("duplicate word_id")

        # Валидируем результаты
        evaluations = []
        for ev in evaluations_raw:
            result = ev.get("result")
            if result not in ("correct", "typo", "incorrect"):
                raise LlmInvalidResponse("invalid result")

            # Валидируем user_fragment
            fragment = ev.get("user_fragment")
            validated_fragment = validate_user_fragment(user_translation, fragment)
            if fragment is not None and validated_fragment is None:
                logger.warning(f"user_fragment not found in user input: {fragment}")

            evaluations.append(
                {
                    "word_id": ev["word_id"],
                    "result": result,
                    "user_fragment": validated_fragment,
                }
            )

        # Обрабатываем подсказки
        suggestions = await _process_suggestions(
            db, profile_id, word_ids, suggested_words_raw
        )

    # ═══════════════════════════════════════════
    # 9. Транзакция записи
    # ═══════════════════════════════════════════
    lesson_number = exercise["lesson_number"]

    async with db.transaction():
        # Блокируем урок
        cur = await db.execute(
            "SELECT id, status FROM lessons WHERE id = %s FOR UPDATE",
            [exercise["lesson_id"]],
        )
        locked_lesson = cur.fetchone()
        if not locked_lesson or locked_lesson["status"] != "in_progress":
            raise ValueError("lesson_not_active")

        # Блокируем упражнение
        cur = await db.execute(
            "SELECT id, status FROM lesson_exercises WHERE id = %s FOR UPDATE",
            [exercise_id],
        )
        locked_exercise = cur.fetchone()
        if locked_exercise["status"] == "evaluated":
            # Идемпотентность: уже оценено
            return await _build_saved_result(db, exercise_id)

        # Обрабатываем каждое целевое слово
        updated_target_words = []
        for tw in target_words:
            wid = tw["word_id"]
            # Находим оценку для этого слова
            ev = next((e for e in evaluations if e["word_id"] == wid), None)
            if not ev:
                ev = {"word_id": wid, "result": "incorrect", "user_fragment": None}

            # Блокируем строку user_words
            cur = await db.execute(
                """SELECT id, status, stage FROM user_words 
                   WHERE learning_profile_id = %s AND word_id = %s FOR UPDATE""",
                [profile_id, wid],
            )
            uw = cur.fetchone()

            stage_after = None
            if uw and uw["status"] == "active":
                # Применяем SRS
                new_stage, due, new_status = srs_update(
                    uw["stage"], ev["result"], lesson_number
                )
                await db.execute(
                    """UPDATE user_words 
                       SET stage = %s, due_lesson_number = %s, status = %s, 
                           last_reviewed_at = now(), updated_at = now()
                       WHERE id = %s""",
                    [new_stage, due, new_status, uw["id"]],
                )
                stage_after = new_stage

            # Обновляем target_words
            tw_copy = tw.copy()
            tw_copy["result"] = ev["result"]
            tw_copy["user_fragment"] = ev["user_fragment"]
            tw_copy["stage_after"] = stage_after
            updated_target_words.append(tw_copy)

        # Формируем suggested_words JSONB
        suggested_words_json = [
            {"word_id": s["word_id"], "state": "suggested"} for s in suggestions
        ]

        # Обновляем упражнение
        await db.execute(
            """UPDATE lesson_exercises 
               SET user_translation = %s, dont_know = %s, status = 'evaluated', 
                   evaluated_at = now(), target_words = %s, suggested_words = %s
               WHERE id = %s""",
            [
                user_translation if not dont_know else None,
                dont_know,
                json.dumps(updated_target_words, ensure_ascii=False),
                json.dumps(suggested_words_json, ensure_ascii=False),
                exercise_id,
            ],
        )

        # Проверяем автозавершение урока
        cur = await db.execute(
            """SELECT COUNT(*) as cnt FROM lesson_exercises 
               WHERE lesson_id = %s AND status = 'pending'""",
            [exercise["lesson_id"]],
        )
        pending_count = cur.fetchone()["cnt"]

        lesson_completed = False
        if pending_count == 0:
            # Получаем таймзону пользователя
            cur = await db.execute(
                """SELECT u.timezone FROM users u 
                   JOIN learning_profiles lp ON lp.user_id = u.id 
                   WHERE lp.id = %s""",
                [profile_id],
            )
            user_tz = cur.fetchone()["timezone"]
            completed_date = get_user_today(user_tz)

            await db.execute(
                """UPDATE lessons 
                   SET status = 'completed', completed_at = now(), completed_local_date = %s
                   WHERE id = %s AND status = 'in_progress'""",
                [completed_date, exercise["lesson_id"]],
            )
            lesson_completed = True

            # Событие завершения урока
            await db.execute(
                "INSERT INTO events (user_id, type, payload) VALUES (%s, %s, %s)",
                [
                    user_id,
                    "lesson_completed",
                    json.dumps({"lesson_id": exercise["lesson_id"]}),
                ],
            )

        # Событие оценки упражнения
        await db.execute(
            "INSERT INTO events (user_id, type, payload) VALUES (%s, %s, %s)",
            [
                user_id,
                "exercise_evaluated",
                json.dumps(
                    {
                        "exercise_id": exercise_id,
                        "lesson_id": exercise["lesson_id"],
                        "dont_know": dont_know,
                    }
                ),
            ],
        )

    # ═══════════════════════════════════════════
    # 10. Формируем ответ
    # ═══════════════════════════════════════════
    words_response = []
    for tw in updated_target_words:
        wd = words_data.get(tw["word_id"])
        words_response.append(
            {
                "word_id": tw["word_id"],
                "lemma": wd["lemma"] if wd else "",
                "pos": wd["pos"] if wd else "",
                "surface_form": tw["surface_form"],
                "result": tw["result"],
                "user_fragment": tw["user_fragment"],
                "translations": wd["translations"] if wd else [],
            }
        )

    return {
        "exercise_id": exercise_id,
        "target_sentence": exercise["target_sentence"],
        "reference_translation": exercise["reference_translation"],
        "user_translation": user_translation if not dont_know else None,
        "words": words_response,
        "suggestions": suggestions,
        "lesson_completed": lesson_completed,
    }


async def _process_suggestions(
    db: AsyncConnection,
    profile_id: int,
    target_word_ids: list[int],
    suggested_raw: list[dict],
) -> list[dict]:
    """
    Обрабатывает подсказки новых слов из ответа LLM.
    
    - Нормализация и удаление дублей
    - Исключение целевых слов упражнения
    - Поиск в справочнике
    - Исключение уже добавленных слов
    - Лимит 3 подсказки
    """
    if not suggested_raw:
        return []

    # Нормализация и удаление дублей
    seen = set()
    normalized = []
    for s in suggested_raw:
        lemma = s.get("lemma", "").strip().lower()
        pos = s.get("pos", "")
        if not lemma or not pos:
            continue
        lemma_key = compute_lemma_key(lemma)
        key = (lemma_key, pos)
        if key in seen:
            continue
        seen.add(key)
        normalized.append({"lemma": lemma, "lemma_key": lemma_key, "pos": pos})

    # Удаляем целевые слова упражнения
    target_keys = set()
    if target_word_ids:
        cur = await db.execute(
            "SELECT lemma_key, pos FROM words WHERE id = ANY(%s)",
            [target_word_ids],
        )
        target_keys = {(r["lemma_key"], r["pos"]) for r in cur.fetchall()}

    normalized = [
        s for s in normalized if (s["lemma_key"], s["pos"]) not in target_keys
    ]

    # Ищем слова в справочнике
    suggestions = []
    for s in normalized:
        cur = await db.execute(
            "SELECT id, lemma, pos, translations FROM words WHERE lemma_key = %s AND pos = %s",
            [s["lemma_key"], s["pos"]],
        )
        word = cur.fetchone()
        if not word:
            continue  # Не найденные слова молча отбрасываются

        # Исключаем слова уже в user_words
        cur = await db.execute(
            "SELECT id FROM user_words WHERE learning_profile_id = %s AND word_id = %s",
            [profile_id, word["id"]],
        )
        if cur.fetchone():
            continue

        suggestions.append(
            {
                "word_id": word["id"],
                "lemma": word["lemma"],
                "pos": word["pos"],
                "translations": word["translations"],
                "state": "suggested",
            }
        )

        if len(suggestions) >= 3:
            break

    return suggestions


async def _build_saved_result(db: AsyncConnection, exercise_id: int) -> dict:
    """
    Строит ответ для уже оценённого упражнения (идемпотентность).
    """
    cur = await db.execute(
        """SELECT le.id, le.target_sentence, le.reference_translation, le.user_translation,
                  le.target_words, le.suggested_words, le.dont_know
           FROM lesson_exercises le WHERE le.id = %s""",
        [exercise_id],
    )
    exercise = cur.fetchone()
    if not exercise:
        raise ValueError("exercise_not_found")

    target_words = exercise["target_words"]
    suggested_words = exercise["suggested_words"]

    # Получаем данные слов
    word_ids = [tw["word_id"] for tw in target_words]
    cur = await db.execute(
        "SELECT id, lemma, pos, translations FROM words WHERE id = ANY(%s)",
        [word_ids],
    )
    words_data = {r["id"]: r for r in cur.fetchall()}

    words_response = []
    for tw in target_words:
        wd = words_data.get(tw["word_id"])
        words_response.append(
            {
                "word_id": tw["word_id"],
                "lemma": wd["lemma"] if wd else "",
                "pos": wd["pos"] if wd else "",
                "surface_form": tw["surface_form"],
                "result": tw["result"],
                "user_fragment": tw["user_fragment"],
                "translations": wd["translations"] if wd else [],
            }
        )

    # Получаем данные подсказок
    suggestions = []
    for sw in suggested_words:
        cur = await db.execute(
            "SELECT id, lemma, pos, translations FROM words WHERE id = %s",
            [sw["word_id"]],
        )
        word = cur.fetchone()
        if word:
            suggestions.append(
                {
                    "word_id": word["id"],
                    "lemma": word["lemma"],
                    "pos": word["pos"],
                    "translations": word["translations"],
                    "state": sw["state"],
                }
            )

    return {
        "exercise_id": exercise_id,
        "target_sentence": exercise["target_sentence"],
        "reference_translation": exercise["reference_translation"],
        "user_translation": exercise["user_translation"],
        "words": words_response,
        "suggestions": suggestions,
        "lesson_completed": False,  # Будет определено на клиенте
    }
