import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from yapper.ai import AIClient, RateLimited, Transcript, clean_segments, parse_json
from yapper.config import Settings
from yapper.main import create_app
from yapper.pipeline import Worker

TOKEN = "test-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
REC_ID = "0f8c2a3e-1111-4222-8333-444455556666"


class FakeAI(AIClient):
    def __init__(self):
        self.transcribe_calls = []
        self.chat_calls = []
        self.stt_failures = []  # exceptions to raise on next transcribe calls
        self.chat_failures = []

    async def aclose(self):
        pass

    async def transcribe(self, path, language, prompt):
        self.transcribe_calls.append((Path(path).name, language, prompt))
        if self.stt_failures:
            raise self.stt_failures.pop(0)
        n = len(self.transcribe_calls)
        return Transcript(
            text=f"मैं कल रिपोर्ट भेजूंगा {n}",
            language="hindi",
            segments=[{"start": 1.0, "end": 4.0, "text": f"मैं कल रिपोर्ट भेजूंगा {n}"}],
        )

    async def chat(self, model, system, user, json_mode=False, max_tokens=4096):
        self.chat_calls.append((model, system[:20], json_mode))
        if self.chat_failures:
            raise self.chat_failures.pop(0)
        if json_mode:
            return json.dumps({
                "title": "Weekly sync",
                "summary": "Discussed the report.",
                "participants": ["Me"],
                "key_points": ["Report is due"],
                "decisions": [],
                "action_items": [{"task": "Send the report", "owner": "Me", "due": "tomorrow", "priority": "high"}],
                "open_questions": [],
                "follow_ups": [],
                "topics": [{"time": "00:00:00", "topic": "Report"}],
            })
        return "I will send the report tomorrow."


@pytest.fixture()
def env(tmp_path):
    settings = Settings(
        token=TOKEN,
        data_dir=tmp_path,
        stt_base_url="http://stt",
        stt_api_key="k",
        stt_model="whisper-large-v3",
        llm_base_url="http://llm",
        llm_api_key="k",
        translate_models=["m-translate", "m-backup"],
        mom_models=["m-mom"],
        worker_enabled=False,
    )
    ai = FakeAI()
    app = create_app(settings, ai)
    with TestClient(app) as client:
        yield client, app.state.worker, ai


def drain(worker: Worker, max_steps: int = 50) -> int:
    steps = 0
    while steps < max_steps and asyncio.run(worker.step()):
        steps += 1
    return steps


def start_recording(client, **extra):
    body = {"id": REC_ID, "title": None, "started_at": "2026-10-04T10:00:00Z", "language": "auto", "device": "SM-S928B", **extra}
    r = client.post("/api/recordings", json=body, headers=AUTH)
    assert r.status_code == 200, r.text


def upload(client, seq, data=b"fake-audio", start_ms=None):
    start_ms = seq * 60000 if start_ms is None else start_ms
    return client.put(
        f"/api/recordings/{REC_ID}/chunks/{seq}",
        files={"file": (f"chunk_{seq}.m4a", data, "audio/mp4")},
        data={"start_ms": str(start_ms), "duration_ms": "60000"},
        headers=AUTH,
    )


def test_auth_required(env):
    client, _, _ = env
    assert client.get("/api/ping").status_code == 401
    assert client.get("/api/ping", headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.get("/api/ping", headers=AUTH).json()["ok"] is True
    assert client.get("/api/ping", params={"token": TOKEN}).status_code == 200
    assert client.get("/healthz").status_code == 200


def test_full_flow(env):
    client, worker, ai = env
    start_recording(client)
    start_recording(client)  # idempotent
    for seq in range(3):
        assert upload(client, seq).status_code == 200

    # chunks are processed live, while still recording; minutes wait for finish
    drain(worker)
    rec = client.get(f"/api/recordings/{REC_ID}", headers=AUTH).json()
    assert rec["chunks"] == {"total": 3, "transcribed": 3, "translated": 3, "errors": 0}
    assert rec["mom"] is None and rec["mom_status"] == "waiting"
    first = rec["chunk_list"][1]
    assert first["text_en"] == "I will send the report tomorrow."
    assert first["segments"][0]["start"] == 61.0  # offset by chunk start
    # previous chunk text is used as the whisper prompt for continuity
    assert "रिपोर्ट" in ai.transcribe_calls[1][2]

    r = client.post(f"/api/recordings/{REC_ID}/finish", json={"chunk_count": 3, "duration_ms": 180000, "ended_at": "2026-10-04T10:03:00Z"}, headers=AUTH)
    assert r.status_code == 200
    drain(worker)
    rec = client.get(f"/api/recordings/{REC_ID}", headers=AUTH).json()
    assert rec["mom_status"] == "done"
    assert rec["title"] == "Weekly sync"
    assert rec["mom"]["action_items"][0]["task"] == "Send the report"

    # action items feed + done state
    items = client.get("/api/action-items", headers=AUTH).json()
    assert len(items) == 1 and items[0]["recording_id"] == REC_ID
    client.put(f"/api/recordings/{REC_ID}/action-items/0", json={"done": True}, headers=AUTH)
    assert client.get("/api/action-items", headers=AUTH).json() == []
    assert len(client.get("/api/action-items?include_done=true", headers=AUTH).json()) == 1

    md = client.get(f"/api/recordings/{REC_ID}/export.md", headers=AUTH).text
    assert "# Weekly sync" in md and "- [x] Send the report" in md and "**[00:01:00]**" in md

    assert client.get("/api/recordings?q=रिपोर्ट", headers=AUTH).json()[0]["id"] == REC_ID
    assert client.get("/api/recordings?q=zzz", headers=AUTH).json() == []

    audio = client.get(f"/api/recordings/{REC_ID}/chunks/0/audio", headers=AUTH)
    assert audio.status_code == 200 and audio.content == b"fake-audio"


def test_duplicate_chunk_upload_is_ignored(env):
    client, worker, ai = env
    start_recording(client)
    upload(client, 0)
    drain(worker)
    r = upload(client, 0)
    assert r.json()["duplicate"] is True
    drain(worker)
    assert len(ai.transcribe_calls) == 1


def test_late_chunk_after_minutes_triggers_regeneration(env):
    client, worker, ai = env
    start_recording(client)
    upload(client, 0)
    client.post(f"/api/recordings/{REC_ID}/finish", json={"chunk_count": 1}, headers=AUTH)
    drain(worker)
    upload(client, 1)
    rec = client.get(f"/api/recordings/{REC_ID}", headers=AUTH).json()
    assert rec["mom_status"] == "pending"
    drain(worker)
    assert client.get(f"/api/recordings/{REC_ID}", headers=AUTH).json()["mom_status"] == "done"


def test_minutes_wait_for_missing_chunks(env):
    client, worker, _ = env
    start_recording(client)
    upload(client, 0)
    client.post(f"/api/recordings/{REC_ID}/finish", json={"chunk_count": 2}, headers=AUTH)
    drain(worker)
    assert client.get(f"/api/recordings/{REC_ID}", headers=AUTH).json()["mom_status"] == "pending"
    upload(client, 1)
    drain(worker)
    assert client.get(f"/api/recordings/{REC_ID}", headers=AUTH).json()["mom_status"] == "done"


def test_stt_rate_limit_pauses_without_losing_chunk(env):
    client, worker, ai = env
    start_recording(client)
    upload(client, 0)
    ai.stt_failures = [RateLimited(retry_after=120, daily=False)]
    drain(worker)
    rec = client.get(f"/api/recordings/{REC_ID}", headers=AUTH).json()
    assert rec["chunk_list"][0]["status"] == "pending"
    assert worker.stt_blocked_until > 0
    worker.stt_blocked_until = 0
    drain(worker)
    assert client.get(f"/api/recordings/{REC_ID}", headers=AUTH).json()["chunk_list"][0]["status"] == "done"


def test_daily_limit_falls_back_to_next_model(env):
    client, worker, ai = env
    start_recording(client)
    upload(client, 0)
    ai.chat_failures = [RateLimited(retry_after=3600, daily=True)]
    drain(worker)
    assert "m-translate" in worker.model_blocked_until
    assert ai.chat_calls[-1][0] == "m-backup"
    assert client.get(f"/api/recordings/{REC_ID}", headers=AUTH).json()["chunk_list"][0]["text_en"]


def test_long_transcript_is_condensed_in_windows(env):
    client, worker, ai = env
    start_recording(client)
    upload(client, 0)
    drain(worker)
    long_text = "word " * 3000  # ~15k chars per chunk -> several windows
    worker.db.execute("UPDATE chunks SET text_en = ?", (long_text,))
    for seq in range(1, 4):
        upload(client, seq)
    drain(worker)
    worker.db.execute("UPDATE chunks SET text_en = ?", (long_text,))
    client.post(f"/api/recordings/{REC_ID}/finish", json={"chunk_count": 4}, headers=AUTH)
    ai.chat_calls.clear()
    drain(worker)
    notes_calls = [c for c in ai.chat_calls if not c[2]]
    assert len(notes_calls) >= 4
    assert ai.chat_calls[-1][2] is True


def test_dictionary_and_delete(env):
    client, worker, ai = env
    r = client.put("/api/dictionary", json={"terms": ["Puneet", " Shopify ", "", "Puneet"]}, headers=AUTH)
    assert r.json()["terms"] == ["Puneet", "Shopify"]
    start_recording(client)
    upload(client, 0)
    drain(worker)
    assert "Puneet, Shopify" in ai.transcribe_calls[0][2]
    assert client.delete(f"/api/recordings/{REC_ID}", headers=AUTH).json()["ok"]
    assert client.get(f"/api/recordings/{REC_ID}", headers=AUTH).status_code == 404


def test_dashboard_served(env):
    client, _, _ = env
    r = client.get("/")
    assert r.status_code == 200 and "Yapper" in r.text


def test_clean_segments_drops_silence_hallucinations():
    segs = clean_segments([
        {"start": 0, "end": 2, "text": " Thank you.", "no_speech_prob": 0.8, "avg_logprob": -1.0},
        {"start": 2, "end": 5, "text": " हम कल मिलते हैं", "no_speech_prob": 0.05, "avg_logprob": -0.2},
        {"start": 5, "end": 9, "text": " है है है है है है", "compression_ratio": 3.4},
    ])
    assert [s["text"] for s in segs] == ["हम कल मिलते हैं"]


def test_parse_json_tolerates_fences():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('Sure! {"a": 2} hope this helps') == {"a": 2}
