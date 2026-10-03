"""
101slovo — Сервис старта урока.
Реализует алгоритм 5.4 из ТЗ: идемпотентность, advisory locks, сверка состава,
кластеризация, генерация предложений через LLM, валидация ответа, финальная транзакция.
"""

import json
import logging
import time

from psycopg import AsyncConnection

from app.core.exceptions import LlmInvalidResponse, LlmUnavailable
from app.services.lesson_preview import get_preview_data
from app.services.llm.helpers import generate_sentences
from app.utils.clustering import cluster_words
from app.utils.datetime import get_user_today
from app.utils.ranking import compute_seed
from app.utils.sentence_validation import validate_group_response

logger = logging.getLogger(__name__)


async def start_lesson(
    db: AsyncConnection,
    *,
    user_id: int,
    profile_id: int,
    word_ids: list[int],
    idempotency_key: str,
) -> dict:
    """
    Алгоритм 5.4: Старт урока.
    
    Этапы:
    1. Валидация идемпотентности
    2. Предпроверки (онбординг, in_progress, лимит)
    3. Advisory lock
    4. Сверка состава с preview
    5. Кластеризация
    6-8. Генерация и валидация с повторами
    9. Транзакция записи
    10. Ответ
    
    Args:
        db: Соединение с БД
        user_id: ID пользователя
        profile_id: ID профиля обучения
        word_ids: Список ID слов для урока
        idempotency_key: Ключ идемпотентности (1-128 символов)
    
    Returns:
        Словарь с информацией о созданном/существующем уроке
    """
    # ═══════════════════════════════════════════
    # 1. Валидация идемпотентности
    # ═══════════════════════════════════════════
    if not idempotency_key or len(idempotency_key) > 128:
        raise ValueError("invalid_idempotency_key")

    # Проверяем существующий урок с этим ключом
    cur = await db.execute(
        """SELECT id, lesson_number, status FROM lessons 
           WHERE learning_profile_id = %s AND idempotency_key = %s""",
        [profile_id, idempotency_key],
    )
    existing_lesson = await cur.fetchone()

    if existing_lesson:
        if existing_lesson["status"] == "in_progress":
            # Возвращаем существующий урок
            return await _build_existing_lesson_response(
                db, existing_lesson["id"], existing_lesson["lesson_number"]
            )
        elif existing_lesson["status"] == "completed":
            raise ValueError("lesson_completed")

    # ═══════════════════════════════════════════
    # 2. Предпроверки
    # ═══════════════════════════════════════════
    # Проверяем незавершённый урок
    cur = await db.execute(
        """SELECT id FROM lessons 
           WHERE learning_profile_id = %s AND status = 'in_progress'""",
        [profile_id],
    )
    if await cur.fetchone():
        raise ValueError("resume_available")

    # Проверяем лимит
    cur = await db.execute(
        """SELECT u.timezone, lp.daily_lesson_limit 
           FROM users u JOIN learning_profiles lp ON lp.user_id = u.id 
           WHERE lp.id = %s""",
        [profile_id],
    )
    profile_row = await cur.fetchone()
    if not profile_row:
        raise ValueError("profile_not_found")

    today = get_user_today(profile_row["timezone"])

    cur = await db.execute(
        """SELECT COUNT(*) as cnt FROM lessons 
           WHERE learning_profile_id = %s AND started_local_date = %s""",
        [profile_id, today],
    )
    lessons_today = (await cur.fetchone())["cnt"]
    if lessons_today >= profile_row["daily_lesson_limit"]:
        raise ValueError("limit_reached")

    # ═══════════════════════════════════════════
    # 3. Advisory lock
    # ═══════════════════════════════════════════
    cur = await db.execute("SELECT pg_try_advisory_lock(%s) as lock_acquired", [profile_id])
    result = await cur.fetchone()
    lock_acquired = result["lock_acquired"] if result else False
    if not lock_acquired:
        raise ValueError("start_in_progress")

    try:
        # ═══════════════════════════════════════════
        # 4. Сверка состава
        # ═══════════════════════════════════════════
        preview = await get_preview_data(db, profile_id)
        if preview.get("state") != "ready":
            raise ValueError("preview_outdated")

        expected_word_ids = set(
            [w["word_id"] for w in preview.get("due_words", [])]
            + [w["word_id"] for w in preview.get("new_words", [])]
        )
        if set(word_ids) != expected_word_ids:
            raise ValueError("preview_outdated")

        # ═══════════════════════════════════════════
        # 5. Кластеризация
        # ═══════════════════════════════════════════
        seed = compute_seed(profile_id, preview["lesson_number"])
        groups = cluster_words(word_ids, seed)

        # Подготавливаем данные для LLM
        word_data = {}
        for w in preview.get("due_words", []):
            word_data[w["word_id"]] = {"lemma": w["lemma"], "pos": w["pos"]}
        for w in preview.get("new_words", []):
            word_data[w["word_id"]] = {"lemma": w["lemma"], "pos": w["pos"]}

        llm_groups = []
        for idx, group in enumerate(groups):
            llm_groups.append(
                {"group_index": idx, "words": [word_data[wid] for wid in group]}
            )

        # ═══════════════════════════════════════════
        # 6-8. Генерация и валидация с повторами
        # ═══════════════════════════════════════════
        deadline = time.monotonic() + 45.0
        valid_results = {}  # group_index -> validated entry
        pending_groups = llm_groups.copy()
        max_content_retries = 2
        attempt = 0

        while pending_groups and attempt <= max_content_retries:
            attempt += 1

            # Получаем уровень профиля
            cur = await db.execute(
                "SELECT level FROM learning_profiles WHERE id = %s", [profile_id]
            )
            level = (await cur.fetchone())["level"]

            try:
                response = await generate_sentences(
                    db,
                    level=level,
                    groups=pending_groups,
                    user_id=user_id,
                )
            except Exception as e:
                logger.error(f"LLM generation failed: {e}")
                raise LlmUnavailable("llm_unavailable")

            # Логируем ответ от LLM для отладки
            logger.info(f"📥 LLM Response type: {type(response)}")
            logger.info(f"📥 LLM Response (full): {response}")
            
            if isinstance(response, list):
                logger.info(f"📥 LLM Response length: {len(response)}")
                for idx, entry in enumerate(response):
                    logger.info(f"📥 Entry {idx}: {entry}")
                    if isinstance(entry, dict):
                        logger.info(f"   - Keys: {list(entry.keys())}")
                        logger.info(f"   - sentence: '{entry.get('sentence', 'MISSING')}'")
                        logger.info(f"   - reference_translation: '{entry.get('reference_translation', 'MISSING')}'")
                        logger.info(f"   - group_index: {entry.get('group_index', 'MISSING')}")

            # Проверяем, что ответ - это список
            if not isinstance(response, list):
                logger.error(f"❌ LLM returned non-list response: {type(response)}")
                logger.error(f"❌ Response content: {response}")
                raise LlmInvalidResponse("LLM response is not a list")

            # Валидируем ответ
            all_sentences = [r.get("sentence", "") for r in valid_results.values()]

            # Группируем ответ по group_index
            response_by_index = {}
            for entry in response:
                # Проверяем, что entry - это словарь
                if not isinstance(entry, dict):
                    logger.warning(f"⚠️ Skipping non-dict entry: {entry}")
                    continue
                
                gi = entry.get("group_index")
                logger.info(f"🔍 Processing entry with group_index={gi}")
                if gi is not None:
                    response_by_index[gi] = entry

            new_pending = []
            for pg in pending_groups:
                gi = pg["group_index"]
                if gi not in response_by_index:
                    new_pending.append(pg)
                    continue

                entry = response_by_index[gi]
                error = validate_group_response(gi, pg["words"], entry, all_sentences)

                if error:
                    logger.warning(f"Group {gi} validation failed: {error}")
                    new_pending.append(pg)
                else:
                    valid_results[gi] = entry
                    all_sentences.append(entry["sentence"])

            pending_groups = new_pending

            # Проверяем дедлайн
            if time.monotonic() > deadline - 5:
                break

        if pending_groups:
            raise LlmInvalidResponse("llm_invalid_response")

        # ═══════════════════════════════════════════
        # 9. Транзакция записи
        # ═══════════════════════════════════════════
        async with db.transaction():
            # Блокируем профиль
            cur = await db.execute(
                """SELECT id, last_lesson_number FROM learning_profiles 
                   WHERE id = %s FOR UPDATE""",
                [profile_id],
            )
            locked_profile = await cur.fetchone()
            if not locked_profile:
                raise ValueError("profile_not_found")

            expected_next = locked_profile["last_lesson_number"] + 1
            if expected_next != preview["lesson_number"]:
                raise ValueError("preview_outdated")

            # Повторная проверка идемпотентности
            cur = await db.execute(
                """SELECT id FROM lessons 
                   WHERE learning_profile_id = %s AND idempotency_key = %s""",
                [profile_id, idempotency_key],
            )
            if await cur.fetchone():
                raise ValueError("idempotency_key_taken")

            # Повторная проверка лимита
            cur = await db.execute(
                """SELECT COUNT(*) as cnt FROM lessons 
                   WHERE learning_profile_id = %s AND started_local_date = %s""",
                [profile_id, today],
            )
            if (await cur.fetchone())["cnt"] >= profile_row["daily_lesson_limit"]:
                raise ValueError("limit_reached")

            # Повторная проверка слов
            due_word_ids = {w["word_id"] for w in preview.get("due_words", [])}
            new_word_ids = {w["word_id"] for w in preview.get("new_words", [])}

            # Проверяем due-слова
            if due_word_ids:
                cur = await db.execute(
                    """SELECT word_id FROM user_words 
                       WHERE learning_profile_id = %s AND word_id = ANY(%s) 
                       AND status = 'active' AND due_lesson_number <= %s""",
                    [profile_id, list(due_word_ids), expected_next],
                )
                valid_due = {r["word_id"] for r in await cur.fetchall()}
                if valid_due != due_word_ids:
                    raise ValueError("words_changed")

            # Проверяем новые слова
            if new_word_ids:
                cur = await db.execute(
                    """SELECT word_id FROM user_words 
                       WHERE learning_profile_id = %s AND word_id = ANY(%s)""",
                    [profile_id, list(new_word_ids)],
                )
                existing_new = {r["word_id"] for r in await cur.fetchall()}
                if existing_new:
                    raise ValueError("words_changed")

            # Записываем новые слова в user_words
            for wid in new_word_ids:
                await db.execute(
                    """INSERT INTO user_words 
                       (learning_profile_id, word_id, status, stage, due_lesson_number, source)
                       VALUES (%s, %s, 'active', 0, %s, 'dictionary')""",
                    [profile_id, wid, expected_next],
                )

            # Обновляем профиль
            await db.execute(
                """UPDATE learning_profiles 
                   SET last_lesson_number = %s, updated_at = now() 
                   WHERE id = %s""",
                [expected_next, profile_id],
            )

            # Вставляем урок
            cur = await db.execute(
                """INSERT INTO lessons 
                   (learning_profile_id, lesson_number, idempotency_key, status, started_at, started_local_date)
                   VALUES (%s, %s, %s, 'in_progress', now(), %s)
                   RETURNING id""",
                [profile_id, expected_next, idempotency_key, today],
            )
            lesson_id = (await cur.fetchone())["id"]

            # Вставляем упражнения
            first_exercise_id = None
            first_exercise_sentence = None

            for idx in range(len(groups)):
                result = valid_results[idx]
                group_words = groups[idx]

                # Формируем target_words JSONB
                target_words_json = []
                for wid in group_words:
                    is_new = wid in new_word_ids
                    sf = None
                    for w in result["words"]:
                        if (
                            w["lemma"].lower() == word_data[wid]["lemma"].lower()
                            and w["pos"] == word_data[wid]["pos"]
                        ):
                            sf = w["surface_form"]
                            break

                    target_words_json.append(
                        {
                            "word_id": wid,
                            "surface_form": sf,
                            "is_new": is_new,
                            "stage_before": 0 if is_new else None,
                            "stage_after": None,
                            "result": None,
                            "user_fragment": None,
                        }
                    )

                # Получаем stage_before для due-слов
                for tw in target_words_json:
                    if not tw["is_new"]:
                        cur = await db.execute(
                            """SELECT stage FROM user_words 
                               WHERE learning_profile_id = %s AND word_id = %s""",
                            [profile_id, tw["word_id"]],
                        )
                        row = await cur.fetchone()
                        tw["stage_before"] = row["stage"] if row else 0

                cur = await db.execute(
                    """INSERT INTO lesson_exercises 
                       (lesson_id, order_index, target_sentence, reference_translation, status, target_words, suggested_words)
                       VALUES (%s, %s, %s, %s, 'pending', %s, '[]')
                       RETURNING id""",
                    [
                        lesson_id,
                        idx + 1,
                        result["sentence"],
                        result["reference_translation"],
                        json.dumps(target_words_json, ensure_ascii=False),
                    ],
                )
                exercise_id = (await cur.fetchone())["id"]

                if idx == 0:
                    first_exercise_id = exercise_id
                    first_exercise_sentence = result["sentence"]

            # События
            await db.execute(
                "INSERT INTO events (user_id, type, payload) VALUES (%s, %s, %s)",
                [
                    user_id,
                    "lesson_started",
                    json.dumps({"lesson_id": lesson_id, "lesson_number": expected_next}),
                ],
            )

            for wid in new_word_ids:
                await db.execute(
                    "INSERT INTO events (user_id, type, payload) VALUES (%s, %s, %s)",
                    [user_id, "new_word_accepted", json.dumps({"word_id": wid})],
                )

        # ═══════════════════════════════════════════
        # 10. Ответ
        # ═══════════════════════════════════════════
        return {
            "lesson_id": lesson_id,
            "lesson_number": expected_next,
            "exercises_total": len(groups),
            "created": True,
            "current_exercise": {
                "exercise_id": first_exercise_id,
                "order_index": 1,
                "sentence": first_exercise_sentence,
            },
        }

    finally:
        # Снимаем advisory lock
        await db.execute("SELECT pg_advisory_unlock(%s)", [profile_id])


async def _build_existing_lesson_response(
    db: AsyncConnection, lesson_id: int, lesson_number: int
) -> dict:
    """
    Строит ответ для существующего урока (идемпотентный повтор).
    
    Args:
        db: Соединение с БД
        lesson_id: ID урока
        lesson_number: Номер урока
    
    Returns:
        Словарь с информацией о существующем уроке
    """
    cur = await db.execute(
        """SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE status = 'evaluated') as done
           FROM lesson_exercises WHERE lesson_id = %s""",
        [lesson_id],
    )
    stats = await cur.fetchone()

    # Получаем первое невыполненное упражнение
    cur = await db.execute(
        """SELECT id, order_index, target_sentence 
           FROM lesson_exercises 
           WHERE lesson_id = %s AND status = 'pending' 
           ORDER BY order_index LIMIT 1""",
        [lesson_id],
    )
    exercise = await cur.fetchone()
    if not exercise:
        # Все упражнения выполнены, но урок ещё in_progress?
        # Это не должно происходить, но обработаем
        raise ValueError("lesson_completed")

    return {
        "lesson_id": lesson_id,
        "lesson_number": lesson_number,
        "exercises_total": stats["total"],
        "created": False,
        "current_exercise": {
            "exercise_id": exercise["id"],
            "order_index": exercise["order_index"],
            "sentence": exercise["target_sentence"],
        },
    }
