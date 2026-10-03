"""
101slovo — Утилиты валидации предложений и ответов LLM.
Реализует проверку surface_form в предложении и валидацию ответа согласно п. 5.4 шаг 7 ТЗ.
"""

import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


def _is_word_char(c: str) -> bool:
    """
    Проверяет, является ли символ частью слова.
    Включает буквы, цифры, апостроф и дефис.
    """
    if not c:
        return False
    return c.isalnum() or c in ("'", "-", "'", "‐", "‑", "‒", "–")


def find_surface_form(sentence: str, surface_form: str) -> Optional[tuple[int, int]]:
    """
    Находит surface_form в предложении как целое слово.
    Возвращает (start, end) или None.
    Учитывает Unicode-границы, апостроф и дефис как часть слова.
    
    Args:
        sentence: Предложение для поиска
        surface_form: Форма слова для поиска
    
    Returns:
        Кортеж (start, end) или None если не найдено
    """
    if not surface_form or not sentence:
        return None

    sentence_lower = sentence.lower()
    surface_lower = surface_form.lower()

    start = sentence_lower.find(surface_lower)
    while start != -1:
        end = start + len(surface_lower)

        # Проверяем границы
        before_ok = start == 0 or not _is_word_char(sentence[start - 1])
        after_ok = end >= len(sentence) or not _is_word_char(sentence[end])

        if before_ok and after_ok:
            return (start, end)

        start = sentence_lower.find(surface_lower, start + 1)

    return None


def contains_cyrillic(text: str) -> bool:
    """
    Проверяет наличие кириллицы в тексте.
    
    Args:
        text: Текст для проверки
    
    Returns:
        True если есть кириллица, иначе False
    """
    for char in text:
        if "\u0400" <= char <= "\u04FF":
            return True
    return False


def normalize_sentence(sentence: str) -> str:
    """
    Нормализует предложение для сравнения.
    Приводит к нижнему регистру, убирает пунктуацию, схлопывает пробелы.
    
    Args:
        sentence: Предложение для нормализации
    
    Returns:
        Нормализованная строка
    """
    text = sentence.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def validate_group_response(
    group_index: int,
    requested_words: list[dict],
    response_entry: dict,
    all_sentences: list[str],
) -> Optional[str]:
    """
    Валидирует одну группу из ответа LLM согласно п. 5.4 шаг 7 ТЗ.
    
    Правила валидации:
    1. sentence не пуста и ≤ 200 символов
    2. reference_translation не пуста и ≤ 300 символов
    3. Множество (lemma, pos) в ответе равно запрошенному
    4. surface_form найдена в предложении
    5. Формы не пересекаются
    6. sentence не содержит кириллицы
    7. reference_translation содержит кириллицу
    8. Предложения не совпадают
    
    Args:
        group_index: Индекс группы
        requested_words: Запрошенные слова для группы
        response_entry: Ответ LLM для группы
        all_sentences: Все уже валидные предложения (для проверки дубликатов)
    
    Returns:
        None если всё ок, иначе строка с ошибкой
    """
    # Логируем входные данные для отладки
    logger.info("=" * 80)
    logger.info(f"🔍 VALIDATING GROUP {group_index}")
    logger.info("=" * 80)
    logger.info(f"response_entry type: {type(response_entry)}")
    
    if not isinstance(response_entry, dict):
        logger.error(f"❌ response_entry is not a dict: {type(response_entry)}")
        logger.error(f"   Value: {response_entry}")
        return f"Group {group_index}: response_entry is not a dict"
    
    logger.info(f"response_entry keys: {list(response_entry.keys())}")
    logger.info("-" * 80)
    logger.info("response_entry (full):")
    logger.info(json.dumps(response_entry, ensure_ascii=False, indent=2) if response_entry else str(response_entry))
    logger.info("-" * 80)
    
    sentence = response_entry.get("sentence", "")
    reference_translation = response_entry.get("reference_translation", "")
    words = response_entry.get("words", [])
    
    logger.info(f"Extracted fields:")
    logger.info(f"   sentence: '{sentence}' (type={type(sentence).__name__}, len={len(sentence) if isinstance(sentence, str) else 'N/A'})")
    logger.info(f"   reference_translation: '{reference_translation}' (type={type(reference_translation).__name__}, len={len(reference_translation) if isinstance(reference_translation, str) else 'N/A'})")
    logger.info(f"   words: {words} (type={type(words).__name__}, len={len(words) if isinstance(words, list) else 'N/A'})")
    logger.info("=" * 80)

    # 6. sentence не пуста и ≤ 200 символов
    if not sentence or len(sentence) > 200:
        logger.error(f"❌ Validation failed: sentence empty or too long")
        logger.error(f"   sentence value: '{sentence}'")
        logger.error(f"   sentence type: {type(sentence)}")
        logger.error(f"   sentence length: {len(sentence) if isinstance(sentence, str) else 'N/A'}")
        return f"Group {group_index}: sentence empty or too long"

    # 7. reference_translation не пуста и ≤ 300 символов
    if not reference_translation or len(reference_translation) > 300:
        return f"Group {group_index}: reference_translation empty or too long"

    # 8. sentence не содержит кириллицы
    if contains_cyrillic(sentence):
        return f"Group {group_index}: sentence contains Cyrillic"

    # 9. reference_translation содержит кириллицу
    if not contains_cyrillic(reference_translation):
        return f"Group {group_index}: reference_translation has no Cyrillic"

    # 10. Предложения не совпадают
    norm_sentence = normalize_sentence(sentence)
    for existing in all_sentences:
        if normalize_sentence(existing) == norm_sentence:
            return f"Group {group_index}: duplicate sentence"

    # 3. Множество (lemma, pos) в ответе равно запрошенному
    requested_set = {(w["lemma"].lower(), w["pos"]) for w in requested_words}
    response_set = {(w.get("lemma", "").lower(), w.get("pos", "")) for w in words}
    if requested_set != response_set:
        return f"Group {group_index}: word set mismatch"

    # 4 и 5. surface_form найдена и формы не пересекаются
    positions = []
    for word_entry in words:
        sf = word_entry.get("surface_form", "")
        if not sf:
            return f"Group {group_index}: missing surface_form for {word_entry.get('lemma')}"

        pos = find_surface_form(sentence, sf)
        if pos is None:
            return f"Group {group_index}: surface_form '{sf}' not found in sentence"

        positions.append(pos)

    # Проверка пересечений позиций
    positions.sort()
    for i in range(len(positions) - 1):
        if positions[i][1] > positions[i + 1][0]:
            return f"Group {group_index}: overlapping word positions"

    return None
