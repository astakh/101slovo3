# Задача 6: Клиент GigaChat (LLM-интеграция) ✅

## Реализовано

### 1. Кастомные исключения (`app/core/exceptions.py`)

Добавлены специфичные для LLM исключения:

- `LlmError` — базовое исключение
- `LlmUnavailable` — 503, сервис недоступен
- `LlmQuotaExceeded` — 503, квота исчерпана (402)
- `LlmInvalidResponse` — 503, невалидный ответ
- `LlmRefused` — 422, контент заблокирован (blacklist)

### 2. Логирование вызовов LLM (`app/services/llm/llm_logger.py`)

#### `log_llm_call()`
Записывает вызов LLM в таблицу `llm_calls` с полной информацией:
- purpose (generate/evaluate)
- user_id, lesson_id, exercise_id
- attempt (номер попытки)
- request (messages, temperature)
- response_raw, response_json
- status (ok/http_error/timeout/invalid_json/invalid_schema/validation_failed)
- http_status, latency_ms
- prompt_tokens, completion_tokens
- error_code

### 3. Клиент GigaChat (`app/services/llm/gigachat.py`)

#### GigaTokenManager
Менеджер токенов с OAuth-авторизацией:
- Хранит токен в памяти процесса
- `asyncio.Lock` для single-flight refresh
- Проверка валидности с запасом 30 секунд
- Принудительное обновление по `force_refresh=True`

#### `token_refresh_loop()`
Фоновая задача обновления токена:
- Запускается в lifespan
- Обновляет токен каждые `GIGACHAT_TOKEN_REFRESH_MINUTES`
- Логирует успехи и ошибки

#### GigaChatClient — Слой A: `chat()`
Сырой вызов GigaChat API:
- `asyncio.Semaphore` для ограничения параллелизма (`GIGACHAT_MAX_CONCURRENCY`)
- Обработка ошибок:
  - **401**: принудительный refresh токена (один раз)
  - **429**: retry с exponential backoff + jitter
  - **402**: квота исчерпана → `LlmQuotaExceeded`
  - **400**: bad request → `LlmUnavailable`
  - **5xx**: server error с retry (до 2 раз)
  - **Таймауты/ошибки соединения**: retry с backoff
- Проверка дедлайна перед каждым повтором
- Если осталось < 5 секунд до дедлайна — не повторяем

#### GigaChatClient — Слой B: `chat_json()`
Вызов LLM + извлечение и валидация JSON:
- Обработка `finish_reason`:
  - `length`: контентный повтор (до `max_content_retries`)
  - `blacklist`: отказ без повтора → `LlmRefused`
- Извлечение JSON из ответа:
  - Убирает markdown-обёртки ```json ... ```
  - Находит первую `{` или `[`
  - Находит парную закрывающую скобку
  - Парсит JSON
- Логирование всех вызовов в `llm_calls`
- Проверка дедлайна перед контентными повторами

#### `_extract_json()`
Извлечение JSON из текста:
- Убирает ```json и ``` обрамления
- Находит начало JSON (`{` или `[`)
- Считает глубину скобок
- Находит парную закрывающую скобку
- Парсит JSON

### 4. Хелперы (`app/services/llm/helpers.py`)

#### `generate_sentences()`
Prompt 1: Генерация предложений
- Дедлайн 45с
- Таймаут попытки 25с
- 2 транспортных повтора
- 2 контентных повтора
- Читает промпт из БД (`prompts` таблица)
- Запасной текст из кода + критичный лог

#### `evaluate_translation()`
Prompt 2: Оценка перевода
- Дедлайн 15с
- Таймаут попытки 10с
- 1 транспортный повтор
- 1 контентный повтор
- Генерирует случайный разделитель `<<<UT_...>>>` для защиты от prompt-injection
- Читает промпт из БД

### 5. Интеграция в `main.py`

#### Lifespan
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    refresh_task = asyncio.create_task(token_refresh_loop())
    yield
    refresh_task.cancel()
    await close_pool()
```

#### Обработчики LLM-исключений
```python
@app.exception_handler(LlmUnavailable)
@app.exception_handler(LlmQuotaExceeded)
@app.exception_handler(LlmInvalidResponse)
@app.exception_handler(LlmRefused)
```

Возвращают JSON с кодом ошибки и сообщением.

## Ключевые особенности

### OAuth-авторизация
- Endpoint: `https://ngw.devices.sberbank.ru:9443/api/v2/oauth`
- Headers: `Authorization: Basic {AUTH_KEY}`, `RqUID: {uuid}`
- Data: `scope={SCOPE}`
- SSL с кастомным CA-сертификатом

### Single-flight refresh
- `asyncio.Lock` предотвращает множественные одновременные refresh
- Double-check pattern после захвата блокировки

### Семафор для параллелизма
- `asyncio.Semaphore(GIGACHAT_MAX_CONCURRENCY)`
- Ограничивает количество одновременных запросов к GigaChat

### Обработка ошибок

#### Транспортные ошибки (retry)
- **401**: один refresh + повтор
- **429**: exponential backoff + jitter
- **5xx**: exponential backoff + jitter
- **Таймауты/ошибки соединения**: backoff

#### Контентные ошибки (retry в chat_json)
- **finish_reason='length'**: повтор до `max_content_retries`
- **finish_reason='blacklist'**: отказ без повтора
- **Невалидный JSON**: повтор до `max_content_retries`

#### Фатальные ошибки (без retry)
- **402**: квота исчерпана
- **400**: bad request

### Дедлайны
- Проверяются перед каждым повтором
- Если осталось < 5 секунд — не повторяем
- Таймаут запроса уменьшается до оставшегося времени

### Логирование
- Все вызовы логируются в `llm_calls`
- Статусы: `ok`, `http_error`, `timeout`, `invalid_json`, `invalid_schema`, `validation_failed`
- Полный контекст: request, response, latency, tokens, error_code

### Защита от prompt-injection
- Случайный разделитель `<<<UT_{uuid}>>>` для оборачивания пользовательского ввода
- Промпт инструктирует LLM игнорировать инструкции внутри разделителя

## Конфигурация

```python
# app/config.py
GIGACHAT_AUTH_KEY: str
GIGACHAT_SCOPE: str
GIGACHAT_MODEL: str
GIGACHAT_CA_CERT_PATH: str
GIGACHAT_MAX_CONCURRENCY: int = 5
GIGACHAT_TOKEN_REFRESH_MINUTES: int = 10
GEN_TEMPERATURE: float = 0.7
EVAL_TEMPERATURE: float = 0.2
```

## Тестирование

```python
from app.services.llm.gigachat import llm_client
from app.services.llm.helpers import generate_sentences, evaluate_translation

# Прямой вызов chat()
response = await llm_client.chat(
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    temperature=0.7,
    max_tokens=100
)

# Вызов chat_json() с логированием
result = await llm_client.chat_json(
    messages=[...],
    temperature=0.7,
    db=db,
    log_context={"purpose": "generate", "user_id": 1}
)

# Генерация предложений
sentences = await generate_sentences(
    db,
    level="A2",
    groups=[
        {"words": [{"word_id": 1, "lemma": "run", "pos": "verb"}]}
    ],
    user_id=1,
    lesson_id=1
)

# Оценка перевода
evaluation = await evaluate_translation(
    db,
    target_sentence="She runs every morning.",
    reference_translation="Она бегает каждое утро.",
    target_words=[{"word_id": 1, "lemma": "run", "pos": "verb"}],
    user_translation="Она бегает каждое утро.",
    user_id=1,
    lesson_id=1,
    exercise_id=1
)
```

## Структура файлов

```
app/services/llm/
├── __init__.py
├── gigachat.py          # Основной клиент (GigaTokenManager, GigaChatClient)
├── llm_logger.py        # Логирование вызовов в llm_calls
└── helpers.py           # generate_sentences(), evaluate_translation()
```

## Чек-лист

- [x] Реализован `GigaTokenManager` с OAuth и `asyncio.Lock` (single-flight)
- [x] Реализована фоновая задача `token_refresh_loop`
- [x] Реализован `GigaChatClient.chat()` (Слой A) с семафором и обработкой ошибок
- [x] Реализован `GigaChatClient.chat_json()` (Слой B) с извлечением JSON и контентными повторами
- [x] Обработаны все коды ошибок: 401, 429, 402, 400, 5xx, `finish_reason`
- [x] Реализовано логирование в `llm_calls`
- [x] Созданы хелперы `generate_sentences()` и `evaluate_translation()`
- [x] Добавлены глобальные обработчики исключений
- [x] Интегрирована фоновая задача в `lifespan`
