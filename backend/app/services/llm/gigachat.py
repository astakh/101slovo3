"""
101slovo — Клиент GigaChat.
Реализует OAuth-авторизацию, фоновое обновление токена, управление параллелизмом,
обработку ошибок и два слоя: chat() и chat_json().
"""

import asyncio
import json
import logging
import random
import ssl
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import settings
from app.core.exceptions import (
    LlmInvalidResponse,
    LlmQuotaExceeded,
    LlmRefused,
    LlmUnavailable,
)
from app.services.llm.llm_logger import log_llm_call

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Токен-менеджер (один на процесс)
# ──────────────────────────────────────────────
class GigaTokenManager:
    """
    Менеджер токенов GigaChat.
    Хранит токен в памяти, обновляет по необходимости.
    Использует asyncio.Lock для single-flight refresh.
    """

    def __init__(self):
        self._access_token: str | None = None
        self._expires_at: datetime | None = None
        self._lock = asyncio.Lock()

    @property
    def is_valid(self) -> bool:
        """Проверяет валидность токена (с запасом 30 секунд)."""
        if not self._access_token or not self._expires_at:
            return False
        return datetime.now(timezone.utc) < self._expires_at - timedelta(seconds=30)

    async def get_token(self, force_refresh: bool = False) -> str:
        """
        Получает актуальный токен.
        Если токен валиден — возвращает его.
        Иначе обновляет (с блокировкой для single-flight).
        """
        if not force_refresh and self.is_valid:
            return self._access_token

        async with self._lock:
            # Double-check после захвата блокировки
            if not force_refresh and self.is_valid:
                return self._access_token
            await self._refresh()
            return self._access_token

    async def _refresh(self) -> None:
        """Обновляет токен через OAuth."""
        rq_uid = str(uuid.uuid4())
        url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
        headers = {
            "Authorization": f"Basic {settings.GIGACHAT_AUTH_KEY}",
            "RqUID": rq_uid,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        data = {"scope": settings.GIGACHAT_SCOPE}

        ssl_context = ssl.create_default_context(cafile=settings.GIGACHAT_CA_CERT_PATH)

        try:
            async with httpx.AsyncClient(verify=ssl_context, timeout=10.0) as client:
                resp = await client.post(url, headers=headers, data=data)
                resp.raise_for_status()
                payload = resp.json()

                self._access_token = payload["access_token"]
                expires_at_ts = payload.get("expires_at")
                if expires_at_ts:
                    self._expires_at = datetime.fromtimestamp(
                        expires_at_ts / 1000, tz=timezone.utc
                    )
                else:
                    self._expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

                logger.info("GigaChat token refreshed successfully")
        except Exception as e:
            logger.critical(f"Failed to refresh GigaChat token: {e}")
            raise LlmUnavailable(f"Token refresh failed: {e}")


# Глобальный экземпляр
token_manager = GigaTokenManager()


async def token_refresh_loop() -> None:
    """
    Фоновая задача обновления токена.
    Запускается в lifespan и работает до отмены.
    """
    interval = settings.GIGACHAT_TOKEN_REFRESH_MINUTES * 60
    while True:
        await asyncio.sleep(interval)
        try:
            await token_manager.get_token(force_refresh=True)
            logger.info("Background GigaChat token refresh completed")
        except Exception as e:
            logger.critical(f"Background GigaChat token refresh failed: {e}")


# ──────────────────────────────────────────────
# Слой A: chat()
# ──────────────────────────────────────────────
class GigaChatClient:
    """
    Клиент GigaChat с двумя слоями:
    - Слой A: chat() — сырой вызов API
    - Слой B: chat_json() — извлечение и валидация JSON
    """

    def __init__(self):
        self._semaphore = asyncio.Semaphore(settings.GIGACHAT_MAX_CONCURRENCY)

    async def chat(
        self,
        messages: list[dict],
        temperature: float,
        max_tokens: int = 2048,
        timeout: float = 25.0,
        deadline: float | None = None,
    ) -> dict:
        """
        Слой A: сырой вызов GigaChat.
        Возвращает полный JSON-ответ API.
        
        Обрабатывает:
        - 401: принудительный refresh токена (один раз)
        - 429: retry с exponential backoff + jitter
        - 402: квота исчерпана
        - 400: bad request
        - 5xx: server error с retry
        - Таймауты и ошибки соединения
        """
        async with self._semaphore:
            return await self._chat_with_retries(
                messages, temperature, max_tokens, timeout, deadline
            )

    async def _chat_with_retries(
        self,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        timeout: float,
        deadline: float | None,
    ) -> dict:
        """Выполняет запрос с ретраями для транспортных ошибок."""
        transport_retries = 0
        max_transport_retries = 2

        while True:
            # Проверяем дедлайн
            if deadline:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise LlmUnavailable("Deadline exceeded")
                timeout = min(timeout, remaining)
                # Если осталось меньше 5 секунд, повтор не делаем
                if remaining < 5 and transport_retries > 0:
                    raise LlmUnavailable("Deadline too close for retry")

            try:
                token = await token_manager.get_token()
                result = await self._make_request(
                    token, messages, temperature, max_tokens, timeout
                )
                return result

            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code

                if status_code == 401:
                    if transport_retries == 0:
                        # Один принудительный refresh и повтор
                        transport_retries += 1
                        try:
                            await token_manager.get_token(force_refresh=True)
                            continue
                        except Exception:
                            raise LlmUnavailable("Token refresh failed after 401")
                    else:
                        logger.critical("GigaChat 401 after token refresh")
                        raise LlmUnavailable("GigaChat auth failed")

                elif status_code == 429:
                    if transport_retries >= max_transport_retries:
                        raise LlmUnavailable("Rate limited after retries")
                    transport_retries += 1
                    retry_after = e.response.headers.get("Retry-After")
                    if retry_after:
                        delay = float(retry_after)
                    else:
                        delay = 1.0 if transport_retries == 1 else 2.0
                    delay += random.uniform(0, 0.5)  # jitter
                    logger.warning(f"GigaChat 429, retrying after {delay:.2f}s")
                    await asyncio.sleep(delay)
                    continue

                elif status_code == 402:
                    logger.critical("GigaChat quota exceeded (402)")
                    raise LlmQuotaExceeded()

                elif status_code == 400:
                    logger.critical(f"GigaChat 400: {e.response.text}")
                    raise LlmUnavailable("Bad request to GigaChat")

                elif 500 <= status_code < 600:
                    if transport_retries >= max_transport_retries:
                        raise LlmUnavailable(f"Server error {status_code}")
                    transport_retries += 1
                    delay = 1.0 * transport_retries + random.uniform(0, 0.5)
                    logger.warning(f"GigaChat {status_code}, retrying after {delay:.2f}s")
                    await asyncio.sleep(delay)
                    continue

                else:
                    raise LlmUnavailable(f"Unexpected HTTP {status_code}")

            except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as e:
                if transport_retries >= max_transport_retries:
                    raise LlmUnavailable(f"Connection error: {e}")
                transport_retries += 1
                delay = 1.0 * transport_retries + random.uniform(0, 0.5)
                logger.warning(f"GigaChat connection error, retrying after {delay:.2f}s")
                await asyncio.sleep(delay)
                continue

    async def _make_request(
        self,
        token: str,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        timeout: float,
    ) -> dict:
        """Выполняет HTTP-запрос к GigaChat API."""
        url = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.GIGACHAT_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        ssl_context = ssl.create_default_context(cafile=settings.GIGACHAT_CA_CERT_PATH)

        async with httpx.AsyncClient(verify=ssl_context, timeout=timeout) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    # ──────────────────────────────────────────────
    # Слой B: chat_json()
    # ──────────────────────────────────────────────
    async def chat_json(
        self,
        messages: list[dict],
        temperature: float,
        max_tokens: int = 2048,
        timeout: float = 25.0,
        deadline: float | None = None,
        max_content_retries: int = 2,
        db: Any = None,
        log_context: dict | None = None,
    ) -> dict:
        """
        Слой B: вызов LLM + извлечение и валидация JSON.
        
        Обрабатывает:
        - finish_reason='length': контентный повтор
        - finish_reason='blacklist': отказ без повтора
        - Невалидный JSON: контентный повтор
        - Логирование всех вызовов в llm_calls
        """
        content_retries = 0
        attempt = 0

        while True:
            attempt += 1
            start_time = time.monotonic()

            try:
                raw_response = await self.chat(
                    messages, temperature, max_tokens, timeout, deadline
                )
                latency_ms = int((time.monotonic() - start_time) * 1000)

                # Извлекаем контент и finish_reason
                choices = raw_response.get("choices", [])
                if not choices:
                    raise LlmInvalidResponse("No choices in response")

                finish_reason = choices[0].get("finish_reason", "")
                content = choices[0].get("message", {}).get("content", "")

                # Обработка finish_reason
                if finish_reason == "length":
                    # Контентная ошибка — повтор
                    content_retries += 1
                    logger.warning(f"Response truncated (length), retry {content_retries}")
                    if content_retries > max_content_retries:
                        raise LlmInvalidResponse("Response truncated (length)")
                    continue

                elif finish_reason == "blacklist":
                    # Контентная ошибка без повтора
                    raise LlmRefused("Content blocked by blacklist")

                # Извлекаем JSON
                parsed_json = self._extract_json(content)

                # Логируем успех
                if db and log_context:
                    await log_llm_call(
                        db,
                        purpose=log_context.get("purpose", "generate"),
                        user_id=log_context.get("user_id"),
                        lesson_id=log_context.get("lesson_id"),
                        exercise_id=log_context.get("exercise_id"),
                        attempt=attempt,
                        request={"messages": messages, "temperature": temperature},
                        response_raw=content,
                        response_json=parsed_json,
                        status="ok",
                        http_status=200,
                        latency_ms=latency_ms,
                        prompt_tokens=raw_response.get("usage", {}).get("prompt_tokens"),
                        completion_tokens=raw_response.get("usage", {}).get("completion_tokens"),
                        error_code=None,
                    )

                return parsed_json

            except (LlmInvalidResponse, json.JSONDecodeError) as e:
                latency_ms = int((time.monotonic() - start_time) * 1000)
                content_retries += 1

                logger.warning(f"JSON parse error: {e}, retry {content_retries}")

                if db and log_context:
                    await log_llm_call(
                        db,
                        purpose=log_context.get("purpose", "generate"),
                        user_id=log_context.get("user_id"),
                        lesson_id=log_context.get("lesson_id"),
                        exercise_id=log_context.get("exercise_id"),
                        attempt=attempt,
                        request={"messages": messages, "temperature": temperature},
                        response_raw=str(e),
                        response_json=None,
                        status="invalid_json",
                        http_status=None,
                        latency_ms=latency_ms,
                        prompt_tokens=None,
                        completion_tokens=None,
                        error_code="invalid_json",
                    )

                if content_retries > max_content_retries:
                    raise LlmInvalidResponse(
                        f"Failed to parse JSON after {max_content_retries} retries"
                    )

                # Проверяем дедлайн перед повтором
                if deadline and deadline - time.monotonic() < 5:
                    raise LlmInvalidResponse("Deadline too close for content retry")

                continue

            except (LlmUnavailable, LlmQuotaExceeded, LlmRefused):
                latency_ms = int((time.monotonic() - start_time) * 1000)
                if db and log_context:
                    await log_llm_call(
                        db,
                        purpose=log_context.get("purpose", "generate"),
                        user_id=log_context.get("user_id"),
                        lesson_id=log_context.get("lesson_id"),
                        exercise_id=log_context.get("exercise_id"),
                        attempt=attempt,
                        request={"messages": messages, "temperature": temperature},
                        response_raw=None,
                        response_json=None,
                        status="http_error",
                        http_status=None,
                        latency_ms=latency_ms,
                        prompt_tokens=None,
                        completion_tokens=None,
                        error_code="llm_error",
                    )
                raise

    def _extract_json(self, text: str) -> dict:
        """
        Извлекает JSON из ответа, убирая обрамление ```.
        
        Обрабатывает:
        - Markdown-обёртки ```json ... ```
        - Лишний текст до/после JSON
        - Несовпадающие скобки
        """
        text = text.strip()

        # Убираем ``` обрамление
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        # Находим первую { или [
        start = -1
        for i, c in enumerate(text):
            if c in ("{", "["):
                start = i
                break

        if start == -1:
            raise LlmInvalidResponse("No JSON found in response")

        # Находим парную закрывающую скобку
        depth = 0
        for i in range(start, len(text)):
            if text[i] in ("{", "["):
                depth += 1
            elif text[i] in ("}", "]"):
                depth -= 1
                if depth == 0:
                    return json.loads(text[start : i + 1])

        raise LlmInvalidResponse("Unmatched JSON brackets")


# Глобальный экземпляр клиента
llm_client = GigaChatClient()
