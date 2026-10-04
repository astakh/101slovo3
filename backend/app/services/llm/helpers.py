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
logger.setLevel(logging.DEBUG)


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
    print("=" * 80)
    print("🚀 generate_sentences() ВЫЗВАНА")
    print("=" * 80)
    print(f"Level: {level}")
    print(f"Groups count: {len(groups)}")
    print(f"Groups: {groups}")
    print("=" * 80)
    
    # Читаем промпт из БД
    cur = await db.execute(
        "SELECT system_template FROM prompts WHERE key = 'generate_sentences'"
    )
    row = await cur.fetchone()
    if row:
        system_template = row["system_template"]
        print(f"✅ Loaded prompt from DB: {len(system_template)} chars")
        logger.info(f"✅ Loaded prompt from DB: {len(system_template)} chars")
    else:
        # Запасной текст из кода + критичный лог
        print("❌ prompt_missing: generate_sentences - using fallback")
        logger.critical("❌ prompt_missing: generate_sentences - using fallback")
        system_template = (
            "Ты лингвист-методист и составляешь учебные предложения. "
            "Для КАЖДОЙ группы слов составь ровно одно короткое предложение уровня {level}. "
            "Верни ответ СТРОГО в формате JSON-массива: "
            "[{\"group_index\": 0, \"sentence\": \"...\", \"reference_translation\": \"...\", \"words\": [...]}]"
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

    # Логируем запрос к LLM
    logger.info("=" * 80)
    logger.info("📤 LLM REQUEST (generate_sentences)")
    logger.info("=" * 80)
    logger.info(f"Level: {level}")
    logger.info(f"Groups count: {len(groups)}")
    logger.info(f"Groups: {json.dumps(groups, ensure_ascii=False, indent=2)}")
    logger.info(f"Temperature: {settings.GEN_TEMPERATURE}")
    logger.info(f"Max tokens: 2048")
    logger.info(f"System message length: {len(system_message)}")
    logger.info("-" * 80)
    logger.info("SYSTEM MESSAGE (FULL):")
    logger.info(system_message)
    logger.info("-" * 80)
    logger.info("USER MESSAGE (FULL):")
    logger.info(json.dumps(user_message, ensure_ascii=False, indent=2))
    logger.info("=" * 80)

    deadline = time.monotonic() + 45.0

    print("=" * 80)
    print("📤 ВЫЗЫВАЕМ llm_client.chat_json()")
    print("=" * 80)
    print(f"Temperature: {settings.GEN_TEMPERATURE}")
    print(f"Max tokens: 2048")
    print(f"Timeout: 25.0s")
    print("=" * 80)

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

    print("=" * 80)
    print("✅ llm_client.chat_json() ЗАВЕРШЁН")
    print("=" * 80)
    print(f"Result type: {type(result)}")
    print(f"Result: {result}")
    print("=" * 80)

    # Логируем результат для отладки
    print("=" * 80)
    print("📦 generate_sentences RESULT")
    print("=" * 80)
    print(f"Result type: {type(result)}")
    print("-" * 80)
    if isinstance(result, (dict, list)):
        print("Result (formatted):")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Result (raw): {result}")
    print("=" * 80)

    # Извлекаем список предложений из ответа LLM
    sentences_list = None
    
    if isinstance(result, list):
        sentences_list = result
    elif isinstance(result, dict):
        # Пробуем извлечь список из различных полей
        for key in ["sentences", "groups", "results", "exercises"]:
            if key in result and isinstance(result[key], list):
                print(f"✅ Extracted list from field '{key}'")
                sentences_list = result[key]
                break
        
        if sentences_list is None:
            print(f"⚠️ Could not extract list from dict, returning as single-item list")
            sentences_list = [result]
    else:
        print(f"❌ Unexpected result type: {type(result)}")
        raise ValueError(f"Unexpected LLM response type: {type(result)}")

    # Преобразуем формат ответа LLM в ожидаемый формат
    # LLM может возвращать:
    # - {"surface_forms": [...], "reference_translation": "...", "group_index": 0}
    # Нам нужно:
    # - {"group_index": 0, "sentence": "...", "reference_translation": "...", "words": [...]}
    
    print("=" * 80)
    print("🔄 NORMALIZING LLM RESPONSE")
    print("=" * 80)
    
    normalized = []
    for idx, sentence_data in enumerate(sentences_list):
        if not isinstance(sentence_data, dict):
            print(f"⚠️ Skipping non-dict entry at index {idx}")
            continue
        
        group_index = sentence_data.get("group_index", idx)
        reference_translation = sentence_data.get("reference_translation", "")
        
        # Получаем sentence (предложение на английском)
        sentence = sentence_data.get("sentence", "")
        
        # Если sentence отсутствует, но есть surface_forms, генерируем предложение
        if not sentence and "surface_forms" in sentence_data:
            surface_forms = sentence_data["surface_forms"]
            if isinstance(surface_forms, list) and surface_forms:
                # Соединяем surface_forms в предложение
                sentence = " ".join(surface_forms)
                print(f"⚠️ Generated sentence from surface_forms: '{sentence}'")
        
        # Получаем words
        words = sentence_data.get("words", [])
        
        # Если words отсутствует, но есть surface_forms, преобразуем
        if not words and "surface_forms" in sentence_data:
            surface_forms = sentence_data["surface_forms"]
            if isinstance(surface_forms, list):
                # Находим соответствующую группу в pending_groups
                pending_group = next((g for g in groups if g.get("group_index") == group_index), None)
                
                if pending_group and "words" in pending_group:
                    # Преобразуем surface_forms в words
                    words = []
                    for i, surface_form in enumerate(surface_forms):
                        if i < len(pending_group["words"]):
                            word_data = pending_group["words"][i]
                            words.append({
                                "word_id": word_data.get("word_id"),
                                "lemma": word_data.get("lemma", ""),
                                "pos": word_data.get("pos", ""),
                                "surface_form": surface_form
                            })
                    print(f"✅ Converted surface_forms to words for group {group_index}")
        
        normalized_entry = {
            "group_index": group_index,
            "sentence": sentence,
            "reference_translation": reference_translation,
            "words": words
        }
        
        print(f"📝 Normalized entry {group_index}:")
        print(f"   sentence: '{sentence}'")
        print(f"   reference_translation: '{reference_translation}'")
        print(f"   words count: {len(words)}")
        
        normalized.append(normalized_entry)
    
    print("=" * 80)
    print(f"✅ Normalized {len(normalized)} entries")
    print("=" * 80)
    
    return normalized


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
    row = await cur.fetchone()
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
