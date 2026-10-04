# Задача 5: Подбор слов (Preview) и Отказ от слова (Decline) ✅

## Реализовано

### 1. Утилиты для детерминированного ранжирования (`app/utils/ranking.py`)

#### `compute_seed(profile_id: int, lesson_number: int) -> str`
Вычисляет seed для урока на основе profile_id и номера урока. Используется SHA-256 для воспроизводимого перемешивания.

#### `compute_rank(seed: str, word_id: int) -> str`
Вычисляет ранг слова для сортировки. Возвращает hex-строку для лексикографической сортировки.

#### `sort_by_rank(words: list[dict], seed: str) -> list[dict]`
Сортирует слова по возрастанию ранга. Детерминированная сортировка — одинаковый seed даёт одинаковый порядок.

### 2. Утилиты для кластеризации слов (`app/utils/clustering.py`)

#### `cluster_words(word_ids: list[int], seed: str) -> list[list[int]]`
Разбивает слова на группы по 1-3 слова для упражнений.

**Алгоритм:**
1. Количество групп: `ceil(N / 3)`
2. Детерминированное перемешивание через `random.Random(seed)`
3. Распределение по группам (размеры отличаются не более чем на 1)
4. Меньшие группы идут первыми

**Примеры:**
- `cluster_words([1], seed)` → `[[1]]`
- `cluster_words([1,2,3,4], seed)` → `[[1,2], [3,4]]`
- `cluster_words([1,2,3,4,5], seed)` → `[[1,2], [3,4,5]]` (меньшие первыми)
- `cluster_words([1,2,3,4,5,6,7], seed)` → `[[1,2], [3,4], [5,6,7]]`

### 3. Сервис подбора слов (`app/services/lesson_preview.py`)

#### `get_preview_data(db: AsyncConnection, profile_id: int) -> dict`
Алгоритм 5.2 из ТЗ: детерминированный подбор слов для урока.

**Логика:**

1. **Получение профиля** — уровень, словарь, лимиты
2. **Проверка resume** — если есть незавершённый урок, возвращаем его
3. **Проверка лимита** — если дневной лимит исчерпан, возвращаем `limit_reached`
4. **Вычисление seed** — `sha256(profile_id:lesson_number)`
5. **Подбор due-слов** — слова для повторения (`status = 'active' AND due_lesson_number <= next`)
6. **Подбор новых слов** — если due меньше N, подбираем новые слова:
   - Уровень: текущий или на ступень ниже (A2→A1, B1→A2, B2→B1)
   - Для общего словаря: только слова с уровнем
   - Для специальных словарей: слова без уровня допускаются
   - Исключение уже изученных слов (`NOT IN user_words`)
7. **Проверка исчерпания** — если слов недостаточно, флаг `dictionary_exhausted`

**Возвращаемые состояния:**
- `resume` — есть незавершённый урок
- `limit_reached` — дневной лимит исчерпан
- `no_words` — нет слов для урока
- `ready` — готовый набор слов

### 4. Роутер уроков (`app/api/v1/lessons.py`)

#### POST /lesson/preview
Подбор слов для следующего урока.

**Проверки:**
- Онбординг завершён
- Профиль обучения существует

**Возвращает:** результат `get_preview_data()`

#### POST /lesson/new-word/decline
Отказ от нового слова (алгоритм 5.3).

**Логика:**
1. Проверка онбординга
2. Проверка отсутствия незавершённого урока
3. Проверка, что слово входит в активный словарь
4. Проверка статуса в `user_words`:
   - Если `ignored` — идемпотентный успех
   - Если `active` или `mastered` — ошибка
5. Вставка как `ignored` с `source = 'decline'`
6. Логирование события `new_word_declined`
7. Пересчёт preview и возврат обновлённого набора

**Идемпотентность:** повторный вызов с тем же словом возвращает успех.

### 5. Интеграция в main.py

```python
app.include_router(lessons.router, prefix="/lesson", tags=["Lesson"])
```

## Ключевые особенности

### Детерминированное ранжирование
- Используется SHA-256 вместо встроенного `hash()` Python
- Seed вычисляется от `profile_id:lesson_number`
- Ранг слова: `sha256(seed:word_id)`
- Одинаковый seed даёт одинаковый порядок слов

### Подбор новых слов
- Уровень: текущий или на ступень ниже
- A1 → только A1
- A2 → A2, A1
- B1 → B1, A2
- B2 → B2, B1

### Общий vs специальный словарь
- **Общий словарь** (`general`): только слова с уровнем
- **Специальные словари**: слова без уровня допускаются

### Кластеризация
- Группы по 1-3 слова
- Размеры отличаются не более чем на 1
- Меньшие группы первыми
- Детерминированное перемешивание от seed

### Идемпотентность отказа
- Повторный отказ от того же слова возвращает успех
- Проверка через `ON CONFLICT DO NOTHING`
- Статус `ignored` не перезаписывается

## SQL-запросы

### Due-слова
```sql
SELECT uw.word_id, w.lemma, w.pos
FROM user_words uw
JOIN words w ON w.id = uw.word_id
WHERE uw.learning_profile_id = %s
  AND uw.status = 'active'
  AND uw.due_lesson_number <= %s
```

### Новые слова (общий словарь)
```sql
SELECT w.id as word_id, w.lemma, w.pos, w.translations, w.level
FROM words w
WHERE %s = ANY(w.dictionary_ids)
  AND w.id NOT IN (
      SELECT word_id FROM user_words WHERE learning_profile_id = %s
  )
  AND w.level IS NOT NULL
  AND w.level = ANY(%s)
```

### Новые слова (специальный словарь)
```sql
SELECT w.id as word_id, w.lemma, w.pos, w.translations, w.level
FROM words w
WHERE %s = ANY(w.dictionary_ids)
  AND w.id NOT IN (
      SELECT word_id FROM user_words WHERE learning_profile_id = %s
  )
  AND (w.level IS NULL OR w.level = ANY(%s))
```

### Отказ от слова
```sql
INSERT INTO user_words (learning_profile_id, word_id, status, stage, due_lesson_number, source)
VALUES (%s, %s, 'ignored', 0, NULL, 'decline')
ON CONFLICT (learning_profile_id, word_id) DO NOTHING
```

## Тестирование

```bash
# Preview
curl -X POST http://localhost:8000/lesson/preview \
  -H "Authorization: Bearer <access_token>"

# Decline word
curl -X POST http://localhost:8000/lesson/new-word/decline \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"word_id": 123}'
```

## Тестирование кластеризации

```python
from app.utils.clustering import cluster_words

def test_clustering():
    seed = "test_seed"
    
    assert cluster_words([1], seed) == [[1]]
    
    groups = cluster_words([1, 2, 3, 4], seed)
    assert len(groups) == 2
    assert sorted([len(g) for g in groups]) == [2, 2]
    
    groups = cluster_words([1, 2, 3, 4, 5], seed)
    assert len(groups) == 2
    assert sorted([len(g) for g in groups]) == [2, 3]
    
    groups = cluster_words([1, 2, 3, 4, 5, 6, 7], seed)
    assert len(groups) == 3
    assert sorted([len(g) for g in groups]) == [2, 2, 3]
```

## Чек-лист

- [x] Реализован `POST /lesson/preview` с алгоритмом 5.2 из ТЗ
- [x] Реализовано детерминированное ранжирование через `sha256`
- [x] Реализована проверка `resume`, `limit_reached`, `no_words`
- [x] Реализован подбор due-слов и новых слов с учётом уровня профиля
- [x] Реализован `POST /lesson/new-word/decline` с идемпотентностью
- [x] Реализована кластеризация слов для групп упражнений
- [x] Подключён роутер в `main.py`
