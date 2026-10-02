# Задача 9: Итоги урока, возобновление и словарь пользователя ✅

## Реализовано

### 1. Сервис итогов урока (`app/services/lesson_summary.py`)

#### `get_lesson_summary(db, user_id, profile_id, lesson_id)`
Алгоритм 5.6 из ТЗ:

**Этап 1: Проверка владения и статуса**
- Проверка существования урока
- Проверка `status = 'completed'`

**Этап 2: Сбор метрик из упражнений**
- Подсчёт `words_total`, `new_words`, `correct`, `typo`, `incorrect`
- Подсчёт `suggestions_added` (с подсказок со `state = 'added'`)
- Вычисление `reviewed = words_total - new_words`
- Вычисление `without_errors = correct + typo`

**Этап 3: Расчёт стрика**
- Получение `timezone` пользователя
- Вызов `calculate_streak()` с датами завершённых уроков

**Этап 4: extended_today**
- Проверка: первый ли это урок за дату
- Подсчёт уроков, завершённых раньше текущего за ту же дату

**Возвращает:**
```json
{
  "lesson_number": 5,
  "words_total": 10,
  "reviewed": 6,
  "new_words": 4,
  "correct": 7,
  "typo": 1,
  "incorrect": 2,
  "without_errors": 8,
  "suggestions_added": 2,
  "streak": {
    "current": 5,
    "longest": 10,
    "today_done": true,
    "extended_today": true
  }
}
```

### 2. Сервис возобновления урока (`app/services/lesson_resume.py`)

#### `get_current_exercise(db, profile_id, lesson_id)`
Возвращает текущее упражнение для возобновления урока:

**Проверки:**
- Существование урока
- Принадлежность профилю
- `status = 'in_progress'`

**Возвращает:**
```json
{
  "lesson_id": 5,
  "exercises_done": 2,
  "exercises_total": 4,
  "current_exercise": {
    "exercise_id": 15,
    "order_index": 3,
    "sentence": "She runs every morning."
  }
}
```

### 3. Сервис словаря пользователя (`app/services/vocabulary.py`)

#### `get_vocabulary_list(db, profile_id, status, query, page, page_size)`
Список слов пользователя с фильтрацией и пагинацией:

**Параметры:**
- `status`: фильтр по статусу (active/mastered/ignored)
- `query`: поиск по lemma или translations (ILIKE)
- `page`/`page_size`: пагинация

**SQL-оптимизации:**
- Динамическое построение WHERE
- Поиск через `ILIKE` с `unnest(translations)`
- Сортировка по `lemma ASC`

**Расчёт `due_in_lessons`:**
- Для `active` слов: `max(due_lesson_number - last_lesson_number, 0)`

**Возвращает:**
```json
{
  "items": [
    {
      "word_id": 1,
      "lemma": "run",
      "pos": "verb",
      "translations": ["бегать"],
      "status": "active",
      "stage": 2,
      "due_in_lessons": 3
    }
  ],
  "total": 50,
  "page": 1,
  "page_size": 20
}
```

#### `get_vocabulary_word(db, profile_id, word_id)`
Карточка слова с полной информацией:

**Возвращает:**
```json
{
  "word_id": 1,
  "lemma": "run",
  "pos": "verb",
  "translations": ["бегать", "бежать"],
  "level": "A1",
  "status": "active",
  "stage": 2,
  "due_in_lessons": 3,
  "last_reviewed_at": "2026-01-10T12:00:00Z",
  "source": "dictionary"
}
```

#### `change_word_status(db, profile_id, word_id, new_status)`
Смена статуса слова с валидацией переходов:

**Разрешённые переходы:**
- `active → ignored` (убрать из повторения)
- `ignored → active` (вернуть в повторение)
- `mastered → active` (вернуть в повторение)

**Идемпотентность:**
- Если уже в целевом статусе → успех

**Логика переходов:**
- `active → ignored`: `due_lesson_number = NULL`
- `ignored/mastered → active`: `stage = 0`, `due_lesson_number = last_lesson_number + 1`

**Блокировка:**
- `FOR UPDATE` для атомарности

### 4. Роутер итогов и возобновления (`app/api/v1/lessons.py` — дополнение)

#### GET /lesson/{lesson_id}/summary
Итоги завершённого урока:
- Проверка онбординга
- Вызов `get_lesson_summary()`
- Обработка ошибок: `lesson_not_found` (404), `lesson_not_completed` (409)

#### GET /lesson/{lesson_id}/current
Текущее упражнение для возобновления:
- Проверка онбординга
- Вызов `get_current_exercise()`
- Обработка ошибок: `lesson_not_found` (404), `lesson_not_active` (409)

### 5. Роутер словаря пользователя (`app/api/v1/vocabulary.py`)

#### GET /vocabulary/list
Список слов с фильтрацией и пагинацией:
- Query-параметры: `status`, `q`, `page`, `page_size`
- Валидация: `page_size` от 1 до 50
- Проверка онбординга

#### GET /vocabulary/word/{word_id}
Карточка слова:
- Проверка онбординга
- Обработка ошибки `word_not_found` (404)

#### PATCH /vocabulary/word/{word_id}/status
Смена статуса слова:
- Body: `{"status": "active" | "ignored"}`
- Проверка онбординга
- Обработка ошибок: `word_not_found` (404), `invalid_transition` (409)

### 6. Интеграция в main.py

```python
from app.api.v1 import vocabulary
app.include_router(vocabulary.router, prefix="/vocabulary", tags=["Vocabulary"])
```

## Ключевые особенности

### Итоги урока
- Сбор метрик из JSONB `target_words` и `suggested_words`
- Расчёт `extended_today` (первый урок за дату)
- Интеграция с алгоритмом стрика

### Возобновление урока
- Поиск первого `pending` упражнения
- Подсчёт прогресса (`exercises_done` / `exercises_total`)

### Словарь пользователя
- **Фильтрация** по статусу (active/mastered/ignored)
- **Поиск** по lemma и translations через `ILIKE` с `unnest()`
- **Пагинация** с лимитом 50 на страницу
- **Расчёт `due_in_lessons`** для активных слов

### Смена статуса
- **Валидация переходов**: только разрешённые комбинации
- **Идемпотентность**: повторный вызов возвращает успех
- **Атомарность**: блокировка `FOR UPDATE`
- **Автоматический расчёт** `due_lesson_number` при возврате в active

### SQL-оптимизации
- Динамическое построение WHERE
- Поиск через `ILIKE` с `unnest(translations)`
- Сортировка по `lemma ASC`
- Блокировки `FOR UPDATE` для атомарности

## Тестирование

```bash
# Итоги урока
curl http://localhost:8000/lesson/5/summary \
  -H "Authorization: Bearer <access_token>"

# Возобновление урока
curl http://localhost:8000/lesson/5/current \
  -H "Authorization: Bearer <access_token>"

# Список слов (все)
curl "http://localhost:8000/vocabulary/list" \
  -H "Authorization: Bearer <access_token>"

# Список слов (фильтр)
curl "http://localhost:8000/vocabulary/list?status=active&q=run&page=1&page_size=20" \
  -H "Authorization: Bearer <access_token>"

# Карточка слова
curl http://localhost:8000/vocabulary/word/1 \
  -H "Authorization: Bearer <access_token>"

# Смена статуса (убрать из повторения)
curl -X PATCH http://localhost:8000/vocabulary/word/1/status \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "ignored"}'

# Смена статуса (вернуть в повторение)
curl -X PATCH http://localhost:8000/vocabulary/word/1/status \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

## Тестирование стрика

```python
# tests/test_streak.py
import pytest
from datetime import date
from app.utils.datetime import calculate_streak

@pytest.mark.parametrize("dates_list,expected_current,expected_longest", [
    ([], 0, 0),
    (["2026-01-10"], 1, 1),
    (["2026-01-09"], 1, 1),  # под угрозой
    (["2026-01-08"], 0, 1),
    (["2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10"], 4, 4),
    (["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-09", "2026-01-10"], 2, 3),
    (["2026-01-09", "2026-01-11"], 2, 2),
])
def test_calculate_streak(dates_list, expected_current, expected_longest):
    """Тестовые случаи из п. 5.6 ТЗ, today = 10-е."""
    today = date(2026, 1, 10)
    dates = {date.fromisoformat(d) for d in dates_list}
    result = calculate_streak(dates, today)
    assert result["current"] == expected_current
    assert result["longest"] == expected_longest
```

## Структура файлов

```
app/
├── services/
│   ├── lesson_summary.py       # Итоги урока
│   ├── lesson_resume.py        # Возобновление урока
│   └── vocabulary.py           # Словарь пользователя
└── api/v1/
    ├── lessons.py              # Роутер (дополнение: summary, current)
    └── vocabulary.py           # Роутер словаря
```

## Чек-лист

- [x] Реализован `GET /lesson/{id}/summary` с метриками из `target_words` и `suggested_words`
- [x] Реализован расчёт `extended_today` (первый урок за дату)
- [x] Реализован `GET /lesson/{id}/current` для возобновления урока
- [x] Реализован `GET /vocabulary/list` с фильтрацией по статусу, поиском и пагинацией
- [x] Реализован `GET /vocabulary/word/{id}` с расчётом `due_in_lessons`
- [x] Реализован `PATCH /vocabulary/word/{id}/status` с валидацией переходов и идемпотентностью
- [x] Смена статуса не влияет на идущий урок (слово в текущем уроке оценивается, но SRS не меняется)
- [x] Написаны автотесты для алгоритма стрика
- [x] Подключён роутер словаря в `main.py`
