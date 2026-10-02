#!/usr/bin/env python3
"""
Скрипт импорта слов из JSON в таблицу words.

Использование:
    python import_words.py <path_to_json_file> [--dictionary-id <id>]

Пример:
    python import_words.py words_a1.json --dictionary-id 1
"""

import json
import os
import sys
import unicodedata
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row


def load_database_url() -> str:
    """
    Загружает DATABASE_URL из файла .env в папке backend/.
    
    Returns:
        Строка подключения к БД
    
    Raises:
        SystemExit: Если .env не найден или DATABASE_URL отсутствует
    """
    # Ищем .env в папке backend
    env_path = Path(__file__).parent.parent / "backend" / ".env"
    
    if not env_path.exists():
        print(f"❌ Файл .env не найден: {env_path}")
        print("   Создайте файл backend/.env с переменной DATABASE_URL")
        sys.exit(1)
    
    # Парсим .env вручную
    env_vars = {}
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                env_vars[key] = value
    
    database_url = env_vars.get("DATABASE_URL")
    if not database_url:
        print("❌ Переменная DATABASE_URL не найдена в backend/.env")
        sys.exit(1)
    
    # Нормализуем URL (убираем +asyncpg, +psycopg)
    for dialect in ("+asyncpg", "+psycopg", "+pg8000", "+aiopg"):
        database_url = database_url.replace(dialect, "")
    
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    return database_url


DATABASE_URL = load_database_url()


def compute_lemma_key(lemma: str) -> str:
    """
    Вычисляет нормализованный ключ леммы.
    
    Args:
        lemma: Оригинальная лемма
        
    Returns:
        Нормализованный ключ (lowercase, NFC normalized)
    """
    normalized = unicodedata.normalize("NFC", lemma.strip())
    return normalized.casefold()


def validate_word(word: dict) -> tuple[bool, str | None]:
    """
    Валидирует структуру слова.
    
    Args:
        word: Словарь с данными слова
        
    Returns:
        (is_valid, error_message)
    """
    required_fields = ["lemma", "pos", "level", "translations"]
    
    for field in required_fields:
        if field not in word:
            return False, f"Отсутствует обязательное поле: {field}"
    
    # Валидация lemma
    lemma = word["lemma"]
    if not isinstance(lemma, str) or len(lemma) == 0 or len(lemma) > 64:
        return False, f"Некорректная lemma: {lemma}"
    
    # Валидация pos
    valid_pos = {"noun", "verb", "adj", "adv", "pron", "prep", "conj", "num", "det", "intj"}
    if word["pos"] not in valid_pos:
        return False, f"Некорректная часть речи: {word['pos']}"
    
    # Валидация level
    valid_levels = {"A1", "A2", "B1", "B2", "C1", "C2"}
    if word["level"] not in valid_levels:
        return False, f"Некорректный уровень: {word['level']}"
    
    # Валидация translations
    translations = word["translations"]
    if not isinstance(translations, list) or len(translations) == 0 or len(translations) > 5:
        return False, f"Некорректный массив переводов: {translations}"
    
    for t in translations:
        if not isinstance(t, str) or len(t) == 0 or len(t) > 100:
            return False, f"Некорректный перевод: {t}"
    
    return True, None


def import_words(json_file: str, dictionary_id: int) -> None:
    """
    Импортирует слова из JSON файла в базу данных.
    
    Args:
        json_file: Путь к JSON файлу
        dictionary_id: ID словаря для связывания
    """
    # Читаем JSON файл
    print(f"📖 Чтение файла: {json_file}")
    
    try:
        with open(json_file, "r", encoding="utf-8") as f:
            words_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Файл не найден: {json_file}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Ошибка парсинга JSON: {e}")
        sys.exit(1)
    
    if not isinstance(words_data, list):
        print("❌ JSON должен содержать массив слов")
        sys.exit(1)
    
    print(f"✅ Загружено {len(words_data)} слов")
    
    # Валидация
    print("\n🔍 Валидация слов...")
    valid_words = []
    invalid_count = 0
    
    for i, word in enumerate(words_data, 1):
        is_valid, error = validate_word(word)
        if is_valid:
            valid_words.append(word)
        else:
            print(f"  ❌ Слово #{i} ({word.get('lemma', '?')}): {error}")
            invalid_count += 1
    
    print(f"✅ Валидных слов: {len(valid_words)}")
    if invalid_count > 0:
        print(f"⚠️  Невалидных слов: {invalid_count}")
    
    if len(valid_words) == 0:
        print("❌ Нет валидных слов для импорта")
        sys.exit(1)
    
    # Подключение к БД
    print("\n🔌 Подключение к базе данных...")
    
    try:
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            print("✅ Подключение установлено")
            
            # Статистика
            added_count = 0
            skipped_count = 0
            error_count = 0
            
            print("\n📝 Импорт слов...")
            
            for i, word in enumerate(valid_words, 1):
                lemma = word["lemma"]
                lemma_key = compute_lemma_key(lemma)
                pos = word["pos"]
                level = word["level"]
                translations = word["translations"]
                
                try:
                    # Проверяем уникальность по (lemma_key, pos)
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            SELECT id FROM words
                            WHERE lemma_key = %s AND pos = %s
                            """,
                            (lemma_key, pos)
                        )
                        existing = cur.fetchone()
                        
                        if existing:
                            # Слово уже существует
                            skipped_count += 1
                            if i <= 10 or i % 100 == 0:  # Показываем первые 10 и каждое 100-е
                                print(f"  ⏭️  [{i}/{len(valid_words)}] Пропущено (уже есть): {lemma} ({pos})")
                            continue
                        
                        # Вставляем новое слово
                        cur.execute(
                            """
                            INSERT INTO words (lemma, lemma_key, pos, level, translations, dictionary_ids)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            RETURNING id
                            """,
                            (lemma, lemma_key, pos, level, translations, [dictionary_id])
                        )
                        
                        word_id = cur.fetchone()["id"]
                        added_count += 1
                        
                        if i <= 10 or i % 100 == 0:
                            print(f"  ✅ [{i}/{len(valid_words)}] Добавлено: {lemma} ({pos}) → ID: {word_id}")
                    
                    conn.commit()
                    
                except Exception as e:
                    error_count += 1
                    print(f"  ❌ [{i}/{len(valid_words)}] Ошибка при импорте {lemma}: {e}")
                    conn.rollback()
            
            # Финальная статистика
            print("\n" + "=" * 60)
            print("📊 Статистика импорта:")
            print(f"  ✅ Добавлено слов: {added_count}")
            print(f"  ⏭️  Пропущено (дубликаты): {skipped_count}")
            print(f"  ❌ Ошибок: {error_count}")
            print("=" * 60)
            
            if added_count > 0:
                print("\n🎉 Импорт успешно завершён!")
            else:
                print("\n⚠️  Ни одно слово не было добавлено")
                
    except Exception as e:
        print(f"\n❌ Ошибка подключения к БД: {e}")
        sys.exit(1)


def main():
    """Главная функция."""
    if len(sys.argv) < 2:
        print("Использование: python import_words.py <path_to_json_file> [--dictionary-id <id>]")
        print("\nПример:")
        print("  python import_words.py words_a1.json --dictionary-id 1")
        sys.exit(1)
    
    json_file = sys.argv[1]
    
    # Парсим --dictionary-id
    dictionary_id = 1  # По умолчанию
    if "--dictionary-id" in sys.argv:
        idx = sys.argv.index("--dictionary-id")
        if idx + 1 < len(sys.argv):
            try:
                dictionary_id = int(sys.argv[idx + 1])
            except ValueError:
                print(f"❌ Неверный dictionary-id: {sys.argv[idx + 1]}")
                sys.exit(1)
    
    print("=" * 60)
    print("📚 101slovo — Импорт слов в базу данных")
    print("=" * 60)
    print(f"\nФайл: {json_file}")
    print(f"Dictionary ID: {dictionary_id}")
    print()
    
    import_words(json_file, dictionary_id)


if __name__ == "__main__":
    main()
