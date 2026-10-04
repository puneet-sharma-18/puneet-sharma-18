import asyncio

import httpx
import pytest

from yapper.ai import AIClient, PermanentAIError, RateLimited


def client_with(handler):
    return AIClient("https://stt/v1", "sk", "whisper-large-v3", "https://llm/v1", "sk", http=httpx.AsyncClient(transport=httpx.MockTransport(handler)))


def test_transcribe_sends_multipart_and_parses(tmp_path):
    audio = tmp_path / "chunk_000001.m4a"
    audio.write_bytes(b"abc")
    seen = {}

    def handler(request: httpx.Request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = request.read()
        return httpx.Response(200, json={
            "language": "marathi",
            "text": "x",
            "segments": [
                {"start": 0.0, "end": 3.2, "text": " आपण उद्या भेटू", "no_speech_prob": 0.01, "avg_logprob": -0.2, "compression_ratio": 1.1},
                {"start": 3.2, "end": 5.0, "text": " Thank you.", "no_speech_prob": 0.9, "avg_logprob": -1.2, "compression_ratio": 1.0},
            ],
        })

    ai = client_with(handler)
    t = asyncio.run(ai.transcribe(audio, "mr", "Puneet"))
    assert seen["url"] == "https://stt/v1/audio/transcriptions"
    assert seen["auth"] == "Bearer sk"
    body = seen["body"]
    assert b'name="language"\r\n\r\nmr' in body and b'name="prompt"\r\n\r\nPuneet' in body
    assert b'name="response_format"\r\n\r\nverbose_json' in body and b"abc" in body
    assert t.language == "marathi" and t.text == "आपण उद्या भेटू"


def test_auto_language_is_not_sent(tmp_path):
    audio = tmp_path / "a.m4a"
    audio.write_bytes(b"abc")
    bodies = []
    ai = client_with(lambda r: bodies.append(r.read()) or httpx.Response(200, json={"text": "hello", "language": "english"}))
    t = asyncio.run(ai.transcribe(audio, "auto", None))
    assert b'name="language"' not in bodies[0]
    assert t.text == "hello"


def test_rate_limit_classification():
    def daily(_):
        return httpx.Response(429, headers={"retry-after": "1800"}, json={"error": {"message": "Rate limit reached on tokens per day (TPD): Limit 100000"}})

    def minute(_):
        return httpx.Response(429, headers={"retry-after": "7"}, json={"error": {"message": "tokens per minute (TPM)"}})

    with pytest.raises(RateLimited) as e:
        asyncio.run(client_with(daily).chat("m", "s", "u"))
    assert e.value.daily and e.value.retry_after == 1800
    with pytest.raises(RateLimited) as e:
        asyncio.run(client_with(minute).chat("m", "s", "u"))
    assert not e.value.daily and e.value.retry_after == 7


def test_bad_request_is_permanent():
    with pytest.raises(PermanentAIError):
        asyncio.run(client_with(lambda _: httpx.Response(400, json={"error": "bad audio"})).chat("m", "s", "u"))


def test_chat_json_mode_payload():
    seen = {}

    def handler(request):
        import json
        seen.update(json.loads(request.read()))
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    asyncio.run(client_with(handler).chat("openai/gpt-oss-120b", "sys", "hi", json_mode=True))
    assert seen["response_format"] == {"type": "json_object"} and seen["model"] == "openai/gpt-oss-120b"
