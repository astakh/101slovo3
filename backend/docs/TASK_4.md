# Задача 4: Dashboard, Профиль, Статистика и Настройки ✅

## Реализовано

### 1. Утилиты для работы с датами (`app/utils/datetime.py`)

#### `get_user_today(user_timezone: str) -> date`
Возвращает текущую дату в часовом поясе пользователя.

#### `get_resets_at(user_timezone: str) -> datetime`
Возвращает UTC-время ближайшей локальной полуночи (сброс дневного лимита).

#### `calculate_streak(dates: set[date], today: date) -> dict`
Алгоритм расчёта стрика из п. 5.6 ТЗ:
- Даты больше `today` приводятся к `today` (остаточный риск смены пояса)
- Определяется anchor (начало отсчёта): `today` или `today - 1`
- Текущий стрик считается от anchor назад
- Максимальный стрик ищется по всем датам

### 2. Схемы данных

#### `app/schemas/dashboard.py`
- `DashboardResponse` — полная сводка для главного экрана
- `DashboardProfile` — уровень и словарь
- `DashboardResume` — незавершённый урок
- `DashboardWords` — сводка слов (active/mastered/ignored)
- `DashboardStreak` — стрик (current/longest/today_done)

#### `app/schemas/profile.py`
- `ProfileStatsResponse` — полная статистика профиля
- `HeatmapEntry` — запись для heatmap (дата + количество)

#### `app/schemas/settings.py`
- `LearningProfileResponse` — профиль обучения с настройками и статистикой
- `LearningProfileUpdate` — обновление профиля
- `TimezoneUpdate` / `TimezoneResponse` — смена часового пояса

### 3. Роутер Dashboard (`app/api/v1/dashboard.py`)

#### GET /dashboard/summary
Возвращает полную сводку для главного экрана:

1. **Профиль** — уровень, словарь
2. **Текущая дата** — в часовом поясе пользователя
3. **Уроки сегодня** — количество начатых уроков
4. **Время сброса лимита** — UTC-время ближайшей полуночи
5. **CTA** (call-to-action):
   - `resume` — есть незавершённый урок
   - `limit_reached` — дневной лимит исчерпан
   - `start` — можно начать новый урок
6. **Resume** — информация о незавершённом уроке (если есть)
7. **Words** — сводка слов по статусам
8. **Streak** — текущий стрик, максимальный, занимался ли сегодня

**SQL-запросы:**
- Получение пользователя и профиля (JOIN users + learning_profiles + dictionaries)
- Подсчёт уроков сегодня (`started_local_date = today`)
- Поиск незавершённого урока (`status = 'in_progress'`)
- Сводка слов (`GROUP BY status`)
- Даты завершения уроков для стрика (`DISTINCT completed_local_date`)

### 4. Роутер Профиля (`app/api/v1/profile.py`)

#### GET /profile/stats
Возвращает полную статистику профиля:

1. **Стрик** — current и longest
2. **Heatmap** — за 12 месяцев (дата + количество уроков)
3. **Точность**:
   - За 30 дней
   - За всё время
   - Считается через `jsonb_array_elements(target_words)` и фильтр по `result IN ('correct', 'typo')`
4. **Слова** — active, mastered, ignored
5. **Завершённые уроки** — количество

**SQL-запросы:**
- Heatmap за 12 месяцев (`GROUP BY completed_local_date`)
- Даты для стрика (`DISTINCT completed_local_date`)
- Точность через `CROSS JOIN LATERAL jsonb_array_elements`
- Сводка слов (`GROUP BY status`)
- Количество завершённых уроков

### 5. Роутер Настроек (`app/api/v1/settings.py`)

#### GET /learning-profile
Возвращает профиль обучения с настройками и статистикой:
- level, dictionary
- daily_lesson_limit (и max из конфига)
- words_per_lesson (и min/max из конфига)
- stats: слова, точность, завершённые уроки

#### PATCH /learning-profile
Обновление профиля обучения:
- level (A1/A2/B1/B2)
- dictionary_id (проверка существования)
- daily_lesson_limit (валидация max)
- words_per_lesson (валидация min/max)

Используется `FOR UPDATE` для блокировки строки.

#### GET /dictionaries
Список словарей с количеством слов:
- JOIN dictionaries + words через `ANY(w.dictionary_ids)`
- Флаг `is_default` для словаря по умолчанию

#### PATCH /settings/timezone
Смена часового пояса с ограничениями:

1. **Валидация IANA** — проверка через `zoneinfo.available_timezones()`
2. **Идемпотентность** — если тот же пояс, просто возвращаем данные
3. **Лимит 7 дней** — проверка `timezone_changed_at`
4. **Возврат данных** — today, lessons_today, resets_at, streak

Используется `FOR UPDATE` для блокировки строки.

## Ключевые особенности

### Алгоритм стрика
- Приведение будущих дат к `today` (защита от смены пояса)
- Anchor: `today` или `today - 1` (если вчера занимался)
- Подсчёт текущего стрика от anchor назад
- Подсчёт максимального стрика по всем датам

### Точность
- Используется `CROSS JOIN LATERAL jsonb_array_elements(target_words)` для разбора JSONB
- Фильтр по `result IN ('correct', 'typo')`
- Отдельные запросы для 30 дней и всего времени

### Смена часового пояса
- Валидация через `zoneinfo.available_timezones()`
- Идемпотентность (повторный запрос с тем же поясом)
- Лимит 7 дней (проверка `timezone_changed_at`)
- Возврат обновлённых данных (today, resets_at, streak)

### SQL-оптимизации
- `FILTER (WHERE ...)` для условного подсчёта
- `FOR UPDATE` для блокировки строк при обновлении
- `GROUP BY` для агрегации
- `DISTINCT` для уникальных дат

## Интеграция в main.py

Добавлены роутеры:
```python
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(profile.router, prefix="/profile", tags=["Profile"])
app.include_router(settings_router.router, tags=["Settings"])
```

## Тестирование

```bash
# Dashboard
curl http://localhost:8000/dashboard/summary \
  -H "Authorization: Bearer <access_token>"

# Profile stats
curl http://localhost:8000/profile/stats \
  -H "Authorization: Bearer <access_token>"

# Learning profile
curl http://localhost:8000/learning-profile \
  -H "Authorization: Bearer <access_token>"

# Update learning profile
curl -X PATCH http://localhost:8000/learning-profile \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"level": "B1", "words_per_lesson": 7}'

# Dictionaries
curl http://localhost:8000/dictionaries

# Update timezone
curl -X PATCH http://localhost:8000/settings/timezone \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"timezone": "Europe/Moscow"}'
```

## Чек-лист

- [x] Реализован `GET /dashboard/summary` с расчётом `cta`, `resets_at`, `lessons_today`, `resume`
- [x] Реализован алгоритм стрика из п. 5.6 ТЗ (с приведением будущих дат к `today`)
- [x] Реализован `GET /profile/stats` с `heatmap`, точностью за 30 дней и всё время
- [x] Реализованы `GET /learning-profile`, `PATCH /learning-profile`, `GET /dictionaries`
- [x] Реализован `PATCH /settings/timezone` с валидацией IANA, идемпотентностью и ограничением в 7 дней
- [x] Все SQL-запросы параметризованы, используются транзакции для изменений
- [x] Подключены роутеры в `main.py`
