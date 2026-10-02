# Задача 8: Проверка упражнения и Разбор ✅

## Реализовано

### 1. Функция SRS (`app/services/srs.py`)

Чистая функция `srs_update(stage, result, lesson_number)` без обращения к БД, строго по п. 5.1 ТЗ.

**Интервалы повторения:** `[1, 2, 3, 7, 11, 30]` уроков
**Максимальная стадия:** 6 (mastered)

**Логика:**
- `correct`/`typo` → stage + 1 (если stage < 6), иначе mastered
- `incorrect` → max(stage - 1, 0)
- `due_lesson_number = lesson_number + INTERVALS[new_stage - 1]`

**Тестовые случаи для урока №10:**
- stage=0, correct → (1, 11, active)
- stage=0, typo → (1, 11, active)
- stage=0, incorrect → (0, 11, active)
- stage=6, correct → (6, None, mastered)
- stage=6, incorrect → (5, 21, active)
- stage=3, incorrect → (2, 12, active)

### 2. Валидация текста (`app/utils/text_validation.py`)

#### `validate_user_translation(text: str) -> str`
Валидация ввода пользователя по п. 5.5 шаг 4:
1. NFC нормализация
2. Trim пробелов
3. Схлопывание множественных пробелов
4. Длина 1-500 символов
5. Удаление управляющих символов (кроме \n и \t)
6. Удаление последовательностей `<<<` и `>>>` (защита от prompt injection)

#### `compute_lemma_key(lemma: str) -> str`
Нормализованный ключ леммы: `casefold(NFC(trim(lemma)))`

#### `normalize_for_comparison(text: str) -> str`
Нормализация для сравнения: NFC + lower + схлопывание пробелов

#### `validate_user_fragment(user_input: str, fragment: str | None) -> str | None`
Проверяет, что фрагмент является подстрокой ввода пользователя (case-insensitive)

### 3. Rate Limiter (`app/core/rate_limit.py` — дополнение)

Добавлены методы:

#### `check_evaluate_limit(user_id: int)`
- 30 запросов в минуту на пользователя
- Скользящее окно 60 секунд

#### `check_report_limit(user_id: int)`
- 20 жалоб в час на пользователя
- Скользящее окно 3600 секунд

### 4. Сервис оценки упражнения (`app/services/lesson_evaluate.py`)

#### `evaluate_exercise(db, user_id, profile_id, exercise_id, user_translation, dont_know)`
Полный алгоритм 5.5 из ТЗ:

**Этап 1: Доступ и состояние**
- Проверка существования упражнения
- Проверка принадлежности профилю

**Этап 2: Идемпотентность**
- Если `status == 'evaluated'` → возврат сохранённого результата

**Этап 3: Порядок**
- Только первое `pending` упражнение можно оценить

**Этап 4: Проверка статуса урока**
- Урок должен быть `in_progress`

**Этап 5: Валидация ввода**
- Если не `dont_know` → валидация через `validate_user_translation()`

**Этап 6: Ветка «Не знаю»**
- Все слова получают `result = 'incorrect'`
- Без вызова LLM
- Без подсказок

**Этап 7: Вызов LLM (Prompt 2)**
- Формирование `llm_target_words` с `correct_translations`
- Вызов `evaluate_translation()` через LLM
- Обработка ошибок: `LlmRefused` → 422, другие → 503

**Этап 8: Валидация ответа LLM**
- Проверка множества `word_id` (равно целевым словам)
- Проверка количества (каждое слово один раз)
- Валидация `result` (correct/typo/incorrect)
- Валидация `user_fragment` через `validate_user_fragment()`
- Обработка подсказок через `_process_suggestions()`

**Этап 9: Транзакция записи**
- Блокировка урока через `FOR UPDATE`
- Блокировка упражнения через `FOR UPDATE`
- Повторная проверка идемпотентности
- Для каждого целевого слова:
  - Блокировка `user_words` через `FOR UPDATE`
  - Применение SRS: `srs_update(stage, result, lesson_number)`
  - Обновление `stage`, `due_lesson_number`, `status`, `last_reviewed_at`
  - Обновление `target_words` JSONB с `result`, `user_fragment`, `stage_after`
- Обновление `suggested_words` JSONB
- Обновление упражнения: `user_translation`, `dont_know`, `status = 'evaluated'`, `evaluated_at`
- Проверка автозавершения урока (нет `pending` упражнений)
- Если урок завершён:
  - Обновление `lessons` со `status = 'completed'`, `completed_at`, `completed_local_date`
  - Событие `lesson_completed`
- Событие `exercise_evaluated`

**Этап 10: Формируем ответ**
- `exercise_id`, `target_sentence`, `reference_translation`, `user_translation`
- `words` — массив с оценками для каждого слова
- `suggestions` — подсказки новых слов
- `lesson_completed` — флаг завершения урока

#### `_process_suggestions(db, profile_id, target_word_ids, suggested_raw)`
Обработка подсказок новых слов:
- Нормализация и удаление дублей через `compute_lemma_key()`
- Исключение целевых слов упражнения
- Поиск в справочнике `words`
- Исключение уже добавленных слов из `user_words`
- Лимит 3 подсказки

#### `_build_saved_result(db, exercise_id)`
Строит ответ для уже оценённого упражнения (идемпотентность):
- Получение данных упражнения
- Получение данных слов из справочника
- Формирование ответа с `words` и `suggestions`

### 5. Роутер (`app/api/v1/lessons.py` — дополнение)

#### POST /lesson/evaluate
Оценка упражнения (алгоритм 5.5):
- Rate limit: 30 запросов/мин
- Проверка онбординга
- Вызов `evaluate_exercise()`
- Обработка ошибок с правильными HTTP-статусами

#### GET /lesson/{lesson_id}/exercises/{exercise_id}/result
Возвращает сохранённый результат упражнения:
- Проверка принадлежности упражнения пользователю
- Вызов `_build_saved_result()`

#### POST /lesson/exercises/{exercise_id}/suggestions/{word_id}
Обработка подсказки:
- `action = 'add'` → добавление в `user_words` со `status = 'active'`, `source = 'suggestion'`
- `action = 'ignore'` → добавление в `user_words` со `status = 'ignored'`, `source = 'decline'`
- Обновление `suggested_words` JSONB с новым `state`
- События: `new_word_accepted` или `new_word_declined`

#### POST /lesson/exercises/{exercise_id}/report
Жалоба на предложение:
- Rate limit: 20 жалоб/час
- Валидация комментария (до 500 символов)
- Проверка принадлежности упражнения
- Upsert жалобы (одна жалоба на упражнение)
- Событие `report_sent`

## Ключевые особенности

### Идемпотентность
- Повторный вызов `/evaluate` возвращает сохранённый результат
- Проверка до и после блокировки `FOR UPDATE`
- Эндпоинт `GET /lesson/{id}/exercises/{eid}/result` для получения результата

### Ветка «Не знаю»
- Без вызова LLM
- Все слова получают `result = 'incorrect'`
- SRS применяется как при `incorrect`
- Без подсказок новых слов

### Валидация ответа LLM
- Проверка множества `word_id` (равно целевым словам)
- Проверка количества (каждое слово один раз)
- Валидация `result` (correct/typo/incorrect)
- Валидация `user_fragment` через `validate_user_fragment()`

### Автозавершение урока
- Проверка количества `pending` упражнений
- Если 0 → обновление `lessons` со `status = 'completed'`
- Установка `completed_at` и `completed_local_date`
- Событие `lesson_completed`

### Подсказки новых слов
- Нормализация через `compute_lemma_key()`
- Удаление дублей
- Исключение целевых слов упражнения
- Поиск в справочнике
- Исключение уже добавленных слов
- Лимит 3 подсказки

### Rate Limiters
- Оценка: 30 запросов/мин на пользователя
- Жалобы: 20 жалоб/час на пользователя
- In-memory хранение (согласно ТЗ MVP)

### Блокировки FOR UPDATE
- Урок: проверка `status = 'in_progress'`
- Упражнение: проверка идемпотентности
- `user_words`: атомарное обновление SRS

### События
- `exercise_evaluated` — оценка упражнения
- `lesson_completed` — завершение урока
- `new_word_accepted` — принятие подсказки
- `new_word_declined` — отклонение подсказки
- `report_sent` — отправка жалобы

## Тестирование

```bash
# Оценка упражнения
curl -X POST http://localhost:8000/lesson/evaluate \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "exercise_id": 1,
    "user_translation": "Она бегает каждое утро.",
    "dont_know": false
  }'

# Ветка "Не знаю"
curl -X POST http://localhost:8000/lesson/evaluate \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "exercise_id": 1,
    "dont_know": true
  }'

# Результат упражнения (идемпотентность)
curl http://localhost:8000/lesson/1/exercises/1/result \
  -H "Authorization: Bearer <access_token>"

# Принятие подсказки
curl -X POST http://localhost:8000/lesson/exercises/1/suggestions/123 \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "add"}'

# Отклонение подсказки
curl -X POST http://localhost:8000/lesson/exercises/1/suggestions/123 \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "ignore"}'

# Жалоба на предложение
curl -X POST http://localhost:8000/lesson/exercises/1/report \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "wrong_translation",
    "comment": "Перевод неточный"
  }'
```

## Тестирование SRS

```python
# tests/test_srs.py
import pytest
from app.services.srs import srs_update

@pytest.mark.parametrize("stage,result,expected_stage,expected_due,expected_status", [
    (0, "correct",   1, 11, "active"),
    (0, "typo",      1, 11, "active"),
    (0, "incorrect", 0, 11, "active"),
    (1, "correct",   2, 12, "active"),
    (2, "correct",   3, 13, "active"),
    (3, "correct",   4, 17, "active"),
    (4, "correct",   5, 21, "active"),
    (5, "correct",   6, 40, "active"),
    (6, "correct",   6, None, "mastered"),
    (6, "incorrect", 5, 21, "active"),
    (3, "incorrect", 2, 12, "active"),
    (1, "incorrect", 0, 11, "active"),
])
def test_srs_update(stage, result, expected_stage, expected_due, expected_status):
    """Тестовые случаи из п. 5.1 ТЗ для урока №10."""
    lesson_number = 10
    new_stage, due, status = srs_update(stage, result, lesson_number)
    assert new_stage == expected_stage
    assert due == expected_due
    assert status == expected_status
```

## Структура файлов

```
app/
├── services/
│   ├── srs.py                    # Алгоритм SRS (чистая функция)
│   └── lesson_evaluate.py        # Сервис оценки упражнения
├── utils/
│   └── text_validation.py        # Валидация текста
├── core/
│   └── rate_limit.py             # Rate limiters (дополнение)
└── api/v1/
    └── lessons.py                # Роутер (дополнение)
```

## Чек-лист

- [x] Реализована чистая функция SRS из п. 5.1 ТЗ
- [x] Реализована валидация ввода пользователя (NFC, trim, длина, удаление `<<<`/`>>>`)
- [x] Реализована ветка «Не знаю» без вызова LLM
- [x] Реализован вызов LLM для оценки перевода (Prompt 2)
- [x] Реализована валидация ответа LLM (множество слов, `result`, `user_fragment`)
- [x] Реализована обработка подсказок новых слов (нормализация, дедупликация, лимит 3)
- [x] Реализована транзакция записи с блокировками и идемпотентностью
- [x] Реализовано автозавершение урока при оценке последнего упражнения
- [x] Реализованы эндпоинты для подсказок (`add`/`ignore`) и жалоб
- [x] Реализован `GET /lesson/{id}/exercises/{eid}/result` для идемпотентности
- [x] Добавлены rate limiters (30/min для оценки, 20/hour для жалоб)
- [x] Написаны автотесты для SRS
