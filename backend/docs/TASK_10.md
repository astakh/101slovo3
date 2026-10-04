# Задача 10: Админка ✅

## Реализованные эндпоинты

### Управление словарями

#### POST /admin/dictionaries/import
Импорт словаря из JSON файла с поддержкой dry_run режима.

**Параметры:**
- `file`: JSON файл (multipart/form-data)
- `dry_run`: boolean (по умолчанию false)

**Формат файла:**
```json
{
  "code": "business",
  "name": "Business English",
  "description": "Business vocabulary",
  "words": [
    {
      "lemma": "meeting",
      "pos": "noun",
      "level": "B1",
      "translations": ["встреча", "совещание"]
    }
  ]
}
```

**Ответ:**
```json
{
  "dictionary": {"id": 5, "code": "business", "name": "Business English"},
  "added": 150,
  "updated": 20,
  "skipped": 5,
  "errors": [{"index": 10, "lemma": "xyz", "error": "invalid pos"}],
  "dry_run": false
}
```

#### GET /admin/dictionaries
Список всех словарей с количеством слов.

### Управление жалобами

#### GET /admin/reports
Список жалоб на предложения с фильтрацией и пагинацией.

**Параметры:**
- `status`: "new" | "processed" (опционально)
- `page`: номер страницы (по умолчанию 1)
- `page_size`: размер страницы (по умолчанию 25, макс 100)

#### PATCH /admin/reports/{id}
Обработка жалобы (изменение статуса).

**Тело запроса:**
```json
{
  "status": "processed",
  "admin_note": "Исправлено"
}
```

### Управление пользователями

#### GET /admin/users
Список пользователей с поиском по email и пагинацией.

**Параметры:**
- `q`: поиск по email (опционально)
- `page`: номер страницы
- `page_size`: размер страницы

#### POST /admin/users/{id}/reset-password
Сброс пароля пользователя с генерацией временного пароля и отзывом всех refresh-токенов.

**Ответ:**
```json
{
  "status": "ok",
  "user_id": 123,
  "temporary_password": "abc123xyz"
}
```

### Просмотр БД (только чтение)

#### GET /admin/db/tables
Список таблиц с приблизительным числом строк и количеством колонок.

#### GET /admin/db/tables/{table_name}
Просмотр содержимого таблицы с маскированием чувствительных данных.

**Параметры:**
- `page`: номер страницы
- `page_size`: размер страницы
- `order_by`: колонка для сортировки
- `order_dir`: "asc" | "desc"
- `search`: поиск по текстовым колонкам

**Особенности:**
- Маскирует `password_hash` и `token_hash`
- Исключает таблицу `schema_migrations`
- Поддерживает поиск по текстовым колонкам
- Автоматическая сортировка по первичному ключу

### Управление промптами LLM

#### GET /admin/prompts
Список промптов без полного текста.

#### GET /admin/prompts/{key}
Получение промпта по ключу с полным текстом.

**Доступные ключи:**
- `generate_sentences` (плейсхолдер: `{level}`)
- `evaluate_translation` (без плейсхолдеров)

#### PUT /admin/prompts/{key}
Обновление промпта с валидацией плейсхолдеров.

**Тело запроса:**
```json
{
  "system_template": "Ты лингвист. Составь предложение уровня {level}..."
}
```

**Валидация:**
- Лишние плейсхолдеры запрещены
- Обязательные плейсхолдеры должны присутствовать
- Шаблон должен успешно рендериться с тестовыми значениями

## Безопасность

### Проверка прав администратора
Все эндпоинты `/admin/*` требуют зависимости `get_current_admin_user_id`, которая проверяет поле `is_admin` в таблице `users`.

### Аудит действий
Все действия администраторов логируются в таблицу `admin_audit_log`:
- `dictionary_import` — импорт словаря
- `report_processed` — обработка жалобы
- `user_password_reset` — сброс пароля
- `prompt_updated` — обновление промпта

### Маскирование чувствительных данных
Просмотрщик БД маскирует:
- `users.password_hash`
- `refresh_tokens.token_hash`

## Реализованные сервисы

### admin_audit.py
Логирование действий администраторов в `admin_audit_log`.

### dictionary_import.py
Импорт словарей из JSON с валидацией:
- Проверка структуры файла
- Валидация слов (lemma, pos, level, translations)
- Обработка дубликатов
- Поддержка dry_run режима
- Атомарная транзакция

## Интеграция

Все роутеры подключены в `main.py`:
```python
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(admin_db.router, prefix="/admin", tags=["Admin DB"])
app.include_router(admin_prompts.router, prefix="/admin", tags=["Admin Prompts"])
```

## Тестирование

```bash
# Импорт словаря (dry_run)
curl -X POST http://localhost:8000/admin/dictionaries/import?dry_run=true \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@dictionary.json"

# Список жалоб
curl "http://localhost:8000/admin/reports?status=new&page=1" \
  -H "Authorization: Bearer <admin_token>"

# Обработка жалобы
curl -X PATCH http://localhost:8000/admin/reports/1 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "processed", "admin_note": "Исправлено"}'

# Сброс пароля
curl -X POST http://localhost:8000/admin/users/123/reset-password \
  -H "Authorization: Bearer <admin_token>"

# Просмотр таблицы
curl "http://localhost:8000/admin/db/tables/users?page=1&page_size=10" \
  -H "Authorization: Bearer <admin_token>"

# Обновление промпта
curl -X PUT http://localhost:8000/admin/prompts/generate_sentences \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"system_template": "Ты лингвист. Составь предложение уровня {level}..."}'
```

## Чек-лист

- [x] Реализована зависимость `get_current_admin_user_id`
- [x] Реализован сервис логирования действий администраторов
- [x] Реализован импорт словарей с `dry_run` и валидацией
- [x] Реализованы эндпоинты жалоб (GET/PATCH)
- [x] Реализован сброс пароля с отзывом refresh-токенов
- [x] Реализован просмотрщик БД (только чтение, маскирование)
- [x] Реализованы эндпоинты промптов с валидацией плейсхолдеров
- [x] Все действия логируются в `admin_audit_log`
- [x] Подключены роутеры в `main.py`
