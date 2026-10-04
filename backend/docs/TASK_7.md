# Задача 7: Старт урока (POST /lesson/start) ✅

## Реализовано

### 1. Схемы данных (`app/schemas/lesson_start.py`)

- `LessonStartRequest` — запрос с `word_ids`
- `CurrentExerciseResponse` — информация о текущем упражнении
- `LessonStartResponse` — ответ с информацией о созданном/существующем уроке

### 2. Утилиты валидации (`app/utils/sentence_validation.py`)

#### `find_surface_form(sentence, surface_form)`
Находит surface_form в предложении как целое слово:
- Учитывает Unicode-границы
- Апостроф и дефис как часть слова
- Case-insensitive поиск
- Возвращает `(start, end)` или `None`

#### `contains_cyrillic(text)`
Проверяет наличие кириллицы в тексте.

#### `normalize_sentence(sentence)`
Нормализует предложение для сравнения:
- Приводит к нижнему регистру
- Убирает пунктуацию
- Схлопывает пробелы

#### `validate_group_response(group_index, requested_words, response_entry, all_sentences)`
Валидирует одну группу из ответа LLM согласно п. 5.4 шаг 7 ТЗ:

**10 правил валидации:**
1. `sentence` не пуста и ≤ 200 символов
2. `reference_translation` не пуста и ≤ 300 символов
3. Множество `(lemma, pos)` в ответе равно запрошенному
4. `surface_form` найдена в предложении
5. Формы не пересекаются
6. `sentence` не содержит кириллицы
7. `reference_translation` содержит кириллицу
8. Предложения не совпадают (проверка дубликатов)

### 3. Сервис старта урока (`app/services/lesson_start.py`)

#### `start_lesson(db, user_id, profile_id, word_ids, idempotency_key)`
Полный алгоритм 5.4 из ТЗ:

**Этап 1: Валидация идемпотентности**
- Проверка длины `idempotency_key` (1-128 символов)
- Поиск существующего урока с этим ключом
- Если `in_progress` — возвращаем существующий урок
- Если `completed` — ошибка

**Этап 2: Предпроверки**
- Проверка незавершённого урока (`resume_available`)
- Проверка дневного лимита (`limit_reached`)
- Получение профиля и таймзоны

**Этап 3: Advisory lock**
- `pg_try_advisory_lock(profile_id)` для предотвращения параллельного старта
- Снятие в `finally` блоке

**Этап 4: Сверка состава**
- Вызов `get_preview_data()` для получения актуального preview
- Проверка `state == 'ready'`
- Сверка `word_ids` с `due_words + new_words`

**Этап 5: Кластеризация**
- Вычисление seed: `sha256(profile_id:lesson_number)`
- Кластеризация слов в группы по 1-3 слова
- Подготовка данных для LLM

**Этапы 6-8: Генерация и валидация с повторами**
- Дедлайн 45 секунд
- Цикл с `max_content_retries = 2`
- Вызов `generate_sentences()` через LLM
- Валидация каждой группы через `validate_group_response()`
- Частичные повторы: только невалидные группы отправляются повторно
- Проверка дедлайна перед каждым повтором

**Этап 9: Финальная транзакция записи**
- Блокировка профиля через `FOR UPDATE`
- Повторная проверка:
  - `last_lesson_number` (сверка с preview)
  - Идемпотентность (повторная проверка `idempotency_key`)
  - Лимит (повторная проверка `lessons_today`)
  - Due-слова (проверка `status = 'active' AND due_lesson_number <= expected_next`)
  - Новые слова (проверка отсутствия в `user_words`)
- Запись новых слов в `user_words` со `status = 'active'`, `stage = 0`, `due_lesson_number = expected_next`
- Обновление `last_lesson_number` в профиле
- Вставка урока в `lessons` со `status = 'in_progress'`
- Вставка упражнений в `lesson_exercises`:
  - `target_words` JSONB с `word_id`, `surface_form`, `is_new`, `stage_before`, `stage_after`, `result`, `user_fragment`
  - `suggested_words` пустой JSONB
- События:
  - `lesson_started` с `lesson_id` и `lesson_number`
  - `new_word_accepted` для каждого нового слова

**Этап 10: Ответ**
- `lesson_id`, `lesson_number`, `exercises_total`
- `created: true` (или `false` для идемпотентного повтора)
- `current_exercise` с `exercise_id`, `order_index`, `sentence`

#### `_build_existing_lesson_response(db, lesson_id, lesson_number)`
Строит ответ для существующего урока (идемпотентный повтор):
- Подсчёт `exercises_total` и `exercises_done`
- Поиск первого невыполненного упражнения (`status = 'pending'`)
- Возврат `created: false`

### 4. Роутер (`app/api/v1/lessons.py`)

#### POST /lesson/start
```python
@router.post("/start", response_model=LessonStartResponse)
async def lesson_start(
    req: LessonStartRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncConnection = Depends(get_db),
    idempotency_key: str = Header(alias="Idempotency-Key"),
):
```

**Заголовок:**
- `Idempotency-Key` — обязательный заголовок (1-128 символов)

**Обработка ошибок:**
- `invalid_idempotency_key` → 422
- `lesson_completed` → 409
- `resume_available` → 409
- `limit_reached` → 409
- `start_in_progress` → 409
- `preview_outdated` → 409
- `words_changed` → 409
- `idempotency_key_taken` → 409
- `profile_not_found` → 404

## Ключевые особенности

### Идемпотентность
- Повторный запрос с тем же `Idempotency-Key` возвращает существующий урок
- Проверка до и после advisory lock
- Проверка внутри транзакции с `FOR UPDATE`

### Advisory locks
- `pg_try_advisory_lock(profile_id)` — неблокирующая попытка захвата
- Предотвращает параллельный старт урока для одного профиля
- Снятие в `finally` блоке (гарантия освобождения)

### Сверка состава
- Сравнение `word_ids` с `due_words + new_words` из preview
- Повторная проверка внутри транзакции
- Проверка `status` и `due_lesson_number` для due-слов
- Проверка отсутствия новых слов в `user_words`

### Частичные повторы
- Валидация каждой группы отдельно
- Только невалидные группы отправляются повторно
- До 2 контентных повторов
- Проверка дедлайна перед каждым повтором

### Строгая валидация
- 10 правил из п. 5.4 шаг 7 ТЗ
- Проверка `surface_form` в предложении
- Проверка отсутствия кириллицы в английском предложении
- Проверка наличия кириллицы в переводе
- Проверка дубликатов предложений
- Проверка непересечения позиций слов

### Финальная транзакция
- Блокировка профиля через `FOR UPDATE`
- Повторные проверки всех условий
- Атомарная запись: урок, упражнения, новые слова, события
- Rollback при любой ошибке

### События
- `lesson_started` — старт урока
- `new_word_accepted` — принятие нового слова

## Тестирование

```bash
# Старт урока
curl -X POST http://localhost:8000/lesson/start \
  -H "Authorization: Bearer <access_token>" \
  -H "Idempotency-Key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d '{"word_ids": [1, 2, 3]}'

# Идемпотентный повтор (вернёт существующий урок)
curl -X POST http://localhost:8000/lesson/start \
  -H "Authorization: Bearer <access_token>" \
  -H "Idempotency-Key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d '{"word_ids": [1, 2, 3]}'
```

## Структура файлов

```
app/
├── schemas/
│   └── lesson_start.py              # Схемы запроса/ответа
├── utils/
│   └── sentence_validation.py       # Валидация предложений
├── services/
│   └── lesson_start.py              # Сервис старта урока
└── api/v1/
    └── lessons.py                   # Роутер (добавлен POST /start)
```

## Чек-лист

- [x] Реализована валидация `Idempotency-Key` (1-128 символов)
- [x] Реализована идемпотентность: повторный запрос возвращает существующий урок
- [x] Реализованы предпроверки (онбординг, `in_progress`, лимит)
- [x] Реализован `pg_try_advisory_lock` для защиты от параллельного старта
- [x] Реализована сверка состава с `preview`
- [x] Реализована кластеризация слов
- [x] Реализована генерация предложений через LLM
- [x] Реализована строгая валидация ответа (10 правил из п. 5.4 шаг 7)
- [x] Реализованы частичные повторы (до 2 раз)
- [x] Реализована финальная транзакция записи (урок, упражнения, `user_words`)
- [x] Реализованы события `lesson_started` и `new_word_accepted`
- [x] Advisory lock снимается в `finally`
