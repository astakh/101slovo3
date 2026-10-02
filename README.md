# 101slovo — Полный проект MVP

**Интервальное повторение английских слов в контексте с интеграцией LLM GigaChat**

## 🎯 О проекте

101slovo — это веб-приложение для изучения английских слов через интервальное повторение (SRS) в контексте предложений, сгенерированных нейросетью GigaChat.

### Ключевые особенности

- **Контекстное обучение**: слова изучаются внутри предложений, а не изолированно
- **LLM-интеграция**: GigaChat генерирует предложения и оценивает переводы
- **Адаптивный SRS**: 7 стадий повторения с интервалами [1, 2, 3, 7, 11, 30] уроков
- **Персонализация**: выбор уровня (A1-B2) и словаря
- **Геймификация**: стрики, статистика, достижения

## 🏗️ Архитектура

### Backend (FastAPI)

```
backend/
├── app/
│   ├── main.py                 # Точка входа, lifespan
│   ├── config.py               # Pydantic Settings
│   ├── db/
│   │   └── pool.py             # psycopg_pool (AsyncConnectionPool)
│   ├── api/
│   │   ├── deps.py             # Зависимости (get_db, get_current_user_id)
│   │   └── v1/                 # Роутеры
│   │       ├── auth.py         # Аутентификация
│   │       ├── onboarding.py   # Онбординг
│   │       ├── dashboard.py    # Дашборд
│   │       ├── profile.py      # Профиль и статистика
│   │       ├── settings.py     # Настройки
│   │       ├── lessons.py      # Уроки (preview, start, evaluate)
│   │       ├── vocabulary.py   # Словарь пользователя
│   │       ├── admin.py        # Админка (словари, жалобы, пользователи)
│   │       ├── admin_db.py     # Просмотр БД
│   │       └── admin_prompts.py # Управление промптами
│   ├── core/
│   │   ├── security.py         # JWT, bcrypt, refresh tokens
│   │   ├── exceptions.py       # Кастомные исключения
│   │   └── rate_limit.py       # Rate limiting
│   ├── services/
│   │   ├── srs.py              # Алгоритм SRS
│   │   ├── lesson_preview.py   # Подбор слов
│   │   ├── lesson_start.py     # Старт урока
│   │   ├── lesson_evaluate.py  # Оценка упражнения
│   │   ├── lesson_summary.py   # Итоги урока
│   │   ├── lesson_resume.py    # Возобновление урока
│   │   ├── vocabulary.py       # Словарь пользователя
│   │   ├── dictionary_import.py # Импорт словарей
│   │   ├── admin_audit.py      # Аудит действий
│   │   └── llm/
│   │       ├── gigachat.py     # Клиент GigaChat
│   │       ├── helpers.py      # Хелперы для LLM
│   │       └── llm_logger.py   # Логирование вызовов
│   └── utils/
│       ├── datetime.py         # Работа с датами и стриком
│       ├── ranking.py          # Детерминированное ранжирование
│       ├── clustering.py       # Кластеризация слов
│       ├── text_validation.py  # Валидация текста
│       └── sentence_validation.py # Валидация предложений
├── sql/
│   └── 001_init.sql            # Миграция БД
└── docs/
    ├── TASK_1.md ... TASK_10.md # Документация задач
    └── README.md               # Этот файл
```

### Frontend (React + Vite + TypeScript)

```
src/
├── App.tsx                     # Главный компонент
├── pages/
│   └── LandingPage.tsx         # Лендинг с документацией
├── api/
│   ├── client.ts               # HTTP клиент
│   └── endpoints.ts            # API endpoints
├── types/
│   └── database.ts             # TypeScript типы
└── store/
    └── auth.ts                 # Auth store
```

## 🚀 Быстрый старт

### Требования

- Python 3.12+
- PostgreSQL 14+
- Node.js 18+
- GigaChat API ключ

### Backend

```bash
cd backend

# 1. Установка зависимостей
pip install -r requirements.txt

# 2. Настройка .env
cp .env.example .env
# Заполните DATABASE_URL, JWT_SECRET, GIGACHAT_AUTH_KEY и т.д.

# 3. Применение миграций
psql -d 101slovo -f sql/001_init.sql

# 4. Запуск сервера
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
# 1. Установка зависимостей
npm install

# 2. Запуск dev сервера
npm run dev

# 3. Сборка для production
npm run build
```

## 📊 База данных

### Основные таблицы

- `users` — пользователи
- `learning_profiles` — профили обучения
- `dictionaries` — словари
- `words` — справочник слов
- `user_words` — слова пользователя (SRS)
- `lessons` — уроки
- `lesson_exercises` — упражнения
- `prompts` — промпты LLM
- `llm_calls` — логи вызовов LLM
- `events` — продуктовые события
- `admin_audit_log` — аудит администраторов

### Индексы

- GIN индексы для JSONB и массивов
- Частичные индексы для активных слов
- Уникальные индексы для идемпотентности

## 🔐 Аутентификация

### JWT токены

- **Access token**: короткоживущий (30 минут), передается в заголовке `Authorization: Bearer <token>`
- **Refresh token**: долгоживущий (30 дней), хранится в httpOnly cookie

### Ротация refresh токенов

- Каждый refresh создает новый токен
- Старый токен помечается как использованный
- Family ID связывает цепочку токенов
- Защита от кражи: при повторном использовании отозванного токена вся семья отзывается

## 🧠 Алгоритм SRS

### Стадии и интервалы

| Стадия | Интервал (уроков) | Описание |
|--------|-------------------|----------|
| 0 | 1 | Первое знакомство |
| 1 | 2 | Первое повторение |
| 2 | 3 | Второе повторение |
| 3 | 7 | Третье повторение |
| 4 | 11 | Четвертое повторение |
| 5 | 30 | Пятое повторение |
| 6 | - | Запомнено (mastered) |

### Логика обновления

- **correct/typo**: stage + 1 (если stage < 6), иначе mastered
- **incorrect**: max(stage - 1, 0)
- **due_lesson_number**: lesson_number + INTERVALS[new_stage - 1]

## 🤖 Интеграция с GigaChat

### Клиент GigaChat

- OAuth авторизация с автоматическим обновлением токена
- Семафор для ограничения параллелизма (5 одновременных запросов)
- Retry логика для transient ошибок (401, 429, 5xx)
- Дедлайны для предотвращения зависаний

### Промпты

1. **generate_sentences**: генерация предложений из групп слов
2. **evaluate_translation**: оценка перевода пользователя

### Логирование

Все вызовы LLM логируются в таблицу `llm_calls` с полной информацией:
- request/response
- latency
- token usage
- статус (ok/error)

## 📱 API Endpoints

### Аутентификация
- `POST /auth/register` — регистрация
- `POST /auth/login` — вход
- `POST /auth/refresh` — обновление токенов
- `POST /auth/logout` — выход
- `GET /auth/me` — профиль пользователя

### Онбординг
- `POST /onboarding/complete` — завершение онбординга
- `GET /onboarding/dictionaries` — список словарей

### Дашборд и профиль
- `GET /dashboard/summary` — сводка для главного экрана
- `GET /profile/stats` — статистика профиля
- `GET /learning-profile` — профиль обучения
- `PATCH /learning-profile` — обновление профиля
- `PATCH /settings/timezone` — смена часового пояса

### Уроки
- `POST /lesson/preview` — подбор слов для урока
- `POST /lesson/new-word/decline` — отказ от слова
- `POST /lesson/start` — старт урока
- `POST /lesson/evaluate` — оценка упражнения
- `GET /lesson/{id}/current` — текущее упражнение
- `GET /lesson/{id}/summary` — итоги урока

### Словарь пользователя
- `GET /vocabulary/list` — список слов
- `GET /vocabulary/word/{id}` — карточка слова
- `PATCH /vocabulary/word/{id}/status` — смена статуса

### Админка
- `POST /admin/dictionaries/import` — импорт словаря
- `GET /admin/reports` — жалобы на предложения
- `PATCH /admin/reports/{id}` — обработка жалобы
- `GET /admin/users` — список пользователей
- `POST /admin/users/{id}/reset-password` — сброс пароля
- `GET /admin/db/tables` — список таблиц БД
- `GET /admin/db/tables/{name}` — содержимое таблицы
- `GET /admin/prompts` — список промптов
- `PUT /admin/prompts/{key}` — обновление промпта

## 🎯 Задачи MVP

Все 10 задач выполнены:

1. ✅ Инициализация проекта и схема БД
2. ✅ Каркас FastAPI, конфигурация, пул БД
3. ✅ Аутентификация и онбординг
4. ✅ Дашборд, профиль, статистика, настройки
5. ✅ Подбор слов (preview) и отказ от слова (decline)
6. ✅ Клиент GigaChat (LLM интеграция)
7. ✅ Старт урока (POST /lesson/start)
8. ✅ Проверка упражнения (POST /lesson/evaluate)
9. ✅ Итоги урока, возобновление, словарь пользователя
10. ✅ Админка: словари, жалобы, пользователи, промпты

## 🔒 Безопасность

- bcrypt для хеширования паролей
- JWT с ротацией refresh токенов
- httpOnly cookie для refresh токена
- Rate limiting для защиты от брутфорса
- Валидация ввода (NFC, длина, запрещенные символы)
- Защита от prompt injection (случайные разделители)
- Маскирование чувствительных данных в админке
- Аудит действий администраторов

## 📈 Масштабируемость

- Async/await для высокой производительности
- Connection pooling для БД
- Семафоры для ограничения нагрузки на LLM
- Индексы для оптимизации запросов
- Пагинация для больших списков

## 🧪 Тестирование

```bash
# Тесты SRS
pytest tests/test_srs.py

# Тесты стрика
pytest tests/test_streak.py

# Тесты кластеризации
pytest tests/test_clustering.py
```

## 📝 Лицензия

MIT

## 👥 Команда

Разработано как MVP проект для демонстрации полного цикла разработки веб-приложения с интеграцией LLM.

---

**Статус**: ✅ MVP завершен
**Версия**: 1.0.0
**Дата**: 2026
