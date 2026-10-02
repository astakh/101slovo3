"""
101slovo — Хелперы для вызова LLM.
Удобные обёртки для Prompt 1 (генерация предложений) и Prompt 2 (оценка перевода).
"""

import json
import logging
import time
import uuid

from psycopg import AsyncConnection

from app.config import settings
from app.services.llm.gigachat import llm_client

logger = logging.getLogger(__name__)


async def generate_sentences(
    db: AsyncConnection,
    *,
    level: str,
    groups: list[dict],
    user_id: int | None = None,
    lesson_id: int | None = None,
) -> list[dict]:
    """
    Prompt 1: Генерация предложений.
    
    Дедлайн 45с, таймаут попытки 25с, 2 транспортных повтора, 2 контентных повтора.
    
    Args:
        db: Соединение с БД
        level: Уровень CEFR (A1/A2/B1/B2)
        groups: Группы слов для генерации предложений
        user_id: ID пользователя (для логирования)
        lesson_id: ID урока (для логирования)
    
    Returns:
        Список предложений с target_words и reference_translation
    """
    # Читаем промпт из БД
    cur = await db.execute(
        "SELECT system_template FROM prompts WHERE key = 'generate_sentences'"
    )
    row = cur.fetchone()
    if row:
        system_template = row["system_template"]
    else:
        # Запасной текст из кода + критичный лог
        logger.critical("prompt_missing: generate_sentences")
        system_template = (
            "Ты лингвист-методист и составляешь учебные предложения. "
            "Для КАЖДОЙ группы слов составь ровно одно короткое предложение уровня {level}."
        )

    system_message = system_template.replace("{level}", level)

    user_message = {
        "level": level,
        "groups": groups,
    }

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": json.dumps(user_message, ensure_ascii=False)},
    ]

    deadline = time.monotonic() + 45.0

    result = await llm_client.chat_json(
        messages=messages,
        temperature=settings.GEN_TEMPERATURE,
        max_tokens=2048,
        timeout=25.0,
        deadline=deadline,
        max_content_retries=2,
        db=db,
        log_context={
            "purpose": "generate",
            "user_id": user_id,
            "lesson_id": lesson_id,
        },
    )

    return result


async def evaluate_translation(
    db: AsyncConnection,
    *,
    target_sentence: str,
    reference_translation: str,
    target_words: list[dict],
    user_translation: str,
    user_id: int | None = None,
    lesson_id: int | None = None,
    exercise_id: int | None = None,
) -> dict:
    """
    Prompt 2: Оценка перевода.
    
    Дедлайн 15с, таймаут попытки 10с, 1 транспортный повтор, 1 контентный повтор.
    
    Args:
        db: Соединение с БД
        target_sentence: Исходное предложение на английском
        reference_translation: Эталонный перевод на русский
        target_words: Список целевых слов для оценки
        user_translation: Перевод пользователя
        user_id: ID пользователя (для логирования)
        lesson_id: ID урока (для логирования)
        exercise_id: ID упражнения (для логирования)
    
    Returns:
        Словарь с оценками для каждого слова и suggested_words
    """
    # Читаем промпт из БД
    cur = await db.execute(
        "SELECT system_template FROM prompts WHERE key = 'evaluate_translation'"
    )
    row = cur.fetchone()
    if row:
        system_message = row["system_template"]
    else:
        logger.critical("prompt_missing: evaluate_translation")
        system_message = "Ты строгий экзаменатор. Оцени перевод."

    # Генерируем случайный разделитель для защиты от prompt-injection
    separator = f"<<<UT_{uuid.uuid4().hex[:8]}>>>"
    wrapped_translation = f"{separator}{user_translation}{separator}"

    user_message = {
        "target_sentence": target_sentence,
        "reference_translation": reference_translation,
        "target_words": target_words,
        "allowed_pos": [
            "noun",
            "verb",
            "adj",
            "adv",
            "pron",
            "prep",
            "conj",
            "num",
            "det",
            "intj",
        ],
        "user_translation": wrapped_translation,
    }

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": json.dumps(user_message, ensure_ascii=False)},
    ]

    deadline = time.monotonic() + 15.0

    result = await llm_client.chat_json(
        messages=messages,
        temperature=settings.EVAL_TEMPERATURE,
        max_tokens=1024,
        timeout=10.0,
        deadline=deadline,
        max_content_retries=1,
        db=db,
        log_context={
            "purpose": "evaluate",
            "user_id": user_id,
            "lesson_id": lesson_id,
            "exercise_id": exercise_id,
        },
    )

    return result
