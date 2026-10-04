"""Thin clients for OpenAI-compatible speech-to-text and chat APIs (Groq by default).

Any provider exposing `/audio/transcriptions` and `/chat/completions` works
(Groq, OpenAI, a local faster-whisper server, Ollama, ...).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx


class AIError(Exception):
    """Transient failure: retry later."""


class PermanentAIError(AIError):
    """The request itself is bad (e.g. corrupt audio); retrying will not help."""


@dataclass
class RateLimited(AIError):
    retry_after: float
    daily: bool
    message: str = ""

    def __str__(self) -> str:  # pragma: no cover - debug aid
        scope = "daily" if self.daily else "short-term"
        return f"rate limited ({scope}), retry after {self.retry_after:.0f}s: {self.message}"


def _raise_for(resp: httpx.Response) -> None:
    if resp.status_code < 400:
        return
    text = resp.text[:500]
    if resp.status_code == 429:
        try:
            retry_after = float(resp.headers.get("retry-after", "20"))
        except ValueError:
            retry_after = 20.0
        daily = bool(re.search(r"per day|\bRPD\b|\bTPD\b|\bASD\b", text, re.I))
        raise RateLimited(retry_after=max(retry_after, 1.0), daily=daily, message=text)
    if resp.status_code in (400, 404, 413, 415, 422):
        raise PermanentAIError(f"HTTP {resp.status_code}: {text}")
    raise AIError(f"HTTP {resp.status_code}: {text}")


@dataclass
class Transcript:
    text: str
    language: str | None
    segments: list[dict[str, Any]]


# Whisper invents these on silence / noise. Dropped when the segment also looks unconfident.
_HALLUCINATIONS = re.compile(
    r"^\s*(thank you( for watching)?|thanks for watching|please subscribe|subscribe|"
    r"bye|you|\.+|सब्सक्राइब|धन्यवाद|शुक्रिया|thank you\.)[\s.!।]*$",
    re.I,
)


def clean_segments(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for s in raw:
        text = (s.get("text") or "").strip()
        if not text:
            continue
        no_speech = float(s.get("no_speech_prob") or 0)
        logprob = float(s.get("avg_logprob") or 0)
        compression = float(s.get("compression_ratio") or 0)
        if no_speech > 0.6 and logprob < -0.7:
            continue
        if compression > 2.6:  # repetitive loop ("hai hai hai hai ...")
            continue
        if _HALLUCINATIONS.match(text) and (no_speech > 0.3 or logprob < -0.5):
            continue
        out.append({"start": float(s.get("start") or 0), "end": float(s.get("end") or 0), "text": text})
    return out


class AIClient:
    def __init__(
        self,
        stt_base_url: str,
        stt_api_key: str,
        stt_model: str,
        llm_base_url: str,
        llm_api_key: str,
        http: httpx.AsyncClient | None = None,
    ):
        self.stt_base_url = stt_base_url
        self.stt_api_key = stt_api_key
        self.stt_model = stt_model
        self.llm_base_url = llm_base_url
        self.llm_api_key = llm_api_key
        self.http = http or httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=20.0))

    async def aclose(self) -> None:
        await self.http.aclose()

    async def transcribe(self, path: Path, language: str | None, prompt: str | None) -> Transcript:
        data: dict[str, str] = {
            "model": self.stt_model,
            "response_format": "verbose_json",
            "temperature": "0",
        }
        if language and language != "auto":
            data["language"] = language
        if prompt:
            data["prompt"] = prompt
        try:
            with path.open("rb") as f:
                resp = await self.http.post(
                    f"{self.stt_base_url}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.stt_api_key}"},
                    data=data,
                    files={"file": (path.name, f, "audio/mp4")},
                )
        except httpx.HTTPError as e:
            raise AIError(f"network error: {e}") from e
        _raise_for(resp)
        body = resp.json()
        segments = clean_segments(body.get("segments") or [])
        if body.get("segments") is None:
            text = (body.get("text") or "").strip()
            segments = [{"start": 0.0, "end": 0.0, "text": text}] if text else []
        text = " ".join(s["text"] for s in segments).strip()
        return Transcript(text=text, language=body.get("language"), segments=segments)

    async def chat(self, model: str, system: str, user: str, json_mode: bool = False, max_tokens: int = 4096) -> str:
        payload: dict[str, Any] = {
            "model": model,
            "temperature": 0.2,
            "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        try:
            resp = await self.http.post(
                f"{self.llm_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.llm_api_key}"},
                json=payload,
            )
        except httpx.HTTPError as e:
            raise AIError(f"network error: {e}") from e
        _raise_for(resp)
        body = resp.json()
        try:
            return body["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as e:
            raise AIError(f"unexpected response: {str(body)[:300]}") from e


def parse_json(text: str) -> dict[str, Any]:
    """Parse a JSON object from an LLM reply, tolerating code fences or leading prose."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        value = json.loads(text)
    except ValueError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise AIError("model did not return JSON")
        try:
            value = json.loads(text[start : end + 1])
        except ValueError as e:
            raise AIError("model returned invalid JSON") from e
    if not isinstance(value, dict):
        raise AIError("model returned non-object JSON")
    return value
