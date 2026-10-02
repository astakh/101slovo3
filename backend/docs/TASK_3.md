# Задача 3: Аутентификация и Онбординг ✅

## Реализовано

### 1. Безопасность (`app/core/security.py`)
- **bcrypt** для хеширования паролей
- **JWT** (HS256) для access-токенов
- **SHA-256** для хеширования refresh-токенов
- **httpOnly cookie** для refresh-токена (Secure, SameSite=Lax)
- Cookie привязан к пути `/auth/refresh` для безопасности

### 2. Rate Limiter (`app/core/rate_limit.py`)
- **IP limit**: 10 запросов в минуту (защита от массовых запросов)
- **Email limit**: 5 неудачных попыток за 15 минут (защита от брутфорса)
- In-memory хранение (согласно ТЗ MVP)
- Метод `cleanup()` для периодической очистки устаревших записей

### 3. Зависимости (`app/api/deps.py`)
- `get_db()` — получение соединения из пула
- `get_current_user_id()` — извлечение user_id из access-токена

### 4. Схемы данных
- `app/schemas/auth.py` — AuthRequest, TokenResponse, UserResponse
- `app/schemas/onboarding.py` — OnboardingRequest, OnboardingResponse, DictionaryResponse

### 5. Роутер аутентификации (`app/api/v1/auth.py`)

#### POST /auth/register
- Валидация email (EmailStr)
- Проверка занятости email
- Хеширование пароля через bcrypt
- Создание пользователя
- Генерация refresh-токена с family_id
- Сохранение хеша токена в БД
- Логирование события `signup`
- Установка httpOnly cookie

#### POST /auth/login
- Rate limit по IP и email
- Проверка email и пароля
- Запись неудачной попытки при ошибке
- Генерация токенов при успехе
- Установка httpOnly cookie

#### POST /auth/refresh
- Извлечение refresh-токена из cookie
- Проверка срока действия
- **Защита от кражи**: если токен уже отозван, отзываем всё семейство (family_id)
- **Ротация**: создание нового токена при каждом обновлении
- Связывание токенов через `replaced_by`

#### POST /auth/logout
- Отзыв текущего refresh-токена
- Удаление cookie

#### GET /auth/me
- Получение информации о текущем пользователе
- Требует access-токен в заголовке Authorization

### 6. Роутер онбординга (`app/api/v1/onboarding.py`)

#### POST /onboarding/complete
- Валидация часового пояса через `zoneinfo.available_timezones()`
- Проверка статуса пользователя (не должен быть уже onboarded)
- Проверка наличия словаря по умолчанию (`DEFAULT_DICTIONARY_CODE`)
- Обновление пользователя (timezone, is_onboarded)
- Создание профиля обучения (level, dictionary_id, limits)
- Логирование события `onboarding_completed`

#### GET /onboarding/dictionaries
- Получение списка доступных словарей
- Используется на этапе онбординга

## Безопасность

### Refresh Token Rotation
Каждый refresh-токен используется только один раз. При обновлении:
1. Старый токен помечается как `revoked_at = now()`
2. Создаётся новый токен с тем же `family_id`
3. Связь сохраняется через `replaced_by`

### Защита от кражи токенов
Если обнаружен повторное использование отозванного токена:
- Все токены в семействе (`family_id`) немедленно отзываются
- Это означает, что токен был украден и используется злоумышленником

### Cookie Security
- `HttpOnly`: недоступен из JavaScript
- `Secure`: передаётся только по HTTPS
- `SameSite=Lax`: защита от CSRF
- `Path=/auth/refresh`: токен отправляется только на эндпоинт обновления

### Rate Limiting
- Защита от брутфорса по email (5 попыток за 15 минут)
- Защита от массовых запросов по IP (10 запросов в минуту)
- In-memory хранение (в production рекомендуется Redis)

## События

Все важные действия логируются в таблицу `events`:
- `signup` — регистрация пользователя
- `onboarding_completed` — завершение онбординга

## Зависимости

Добавлены в `requirements.txt`:
- `email-validator==2.2.0` — для `EmailStr` в Pydantic

## Тестирование

```bash
# Регистрация
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# Вход
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# Обновление токена (cookie автоматически отправляется)
curl -X POST http://localhost:8000/auth/refresh \
  -H "Cookie: refresh_token=<token>"

# Профиль пользователя
curl http://localhost:8000/auth/me \
  -H "Authorization: Bearer <access_token>"

# Онбординг
curl -X POST http://localhost:8000/onboarding/complete \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"timezone": "Europe/Moscow", "level": "A2"}'
```

## Чек-лист

- [x] Реализованы `register`, `login`, `refresh`, `logout`
- [x] Настроена ротация refresh-токенов с защитой от кражи (`family_id`)
- [x] Токены хранятся в БД только в виде SHA-256 хешей
- [x] Cookie установлены с флагами `HttpOnly`, `Secure`, `SameSite=Lax`
- [x] Реализован in-memory Rate Limiter для защиты от брутфорса
- [x] Реализован онбординг с проверкой `DEFAULT_DICTIONARY_CODE` и созданием `learning_profiles`
- [x] События `signup` и `onboarding_completed` пишутся в таблицу `events`
- [x] Добавлен эндпоинт `GET /auth/me` для получения профиля
- [x] Добавлен эндпоинт `GET /onboarding/dictionaries` для списка словарей
