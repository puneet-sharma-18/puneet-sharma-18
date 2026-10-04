"""Yapper API server + dashboard."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import secrets
import shutil
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .ai import AIClient
from .config import Settings, load_settings
from .db import DB, loads
from .pipeline import Worker, fmt_ts

log = logging.getLogger("yapper")
STATIC_DIR = Path(__file__).parent / "static"
ID_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")
MAX_CHUNK_BYTES = 24 * 1024 * 1024  # Groq free tier accepts files up to 25 MB


class RecordingIn(BaseModel):
    id: str
    title: str | None = None
    started_at: str
    language: Literal["auto", "hi", "en", "mr"] = "auto"
    source: str | None = "android"
    device: str | None = None


class FinishIn(BaseModel):
    ended_at: str | None = None
    chunk_count: int | None = Field(default=None, ge=0)
    duration_ms: int | None = Field(default=None, ge=0)


class RecordingPatch(BaseModel):
    title: str | None = None
    language: Literal["auto", "hi", "en", "mr"] | None = None


class TermsIn(BaseModel):
    terms: list[str]


class ActionItemIn(BaseModel):
    done: bool


def create_app(settings: Settings | None = None, ai: AIClient | None = None) -> FastAPI:
    settings = settings or load_settings()
    settings.audio_dir.mkdir(parents=True, exist_ok=True)
    db = DB(settings.db_path)
    ai = ai or AIClient(
        settings.stt_base_url, settings.stt_api_key, settings.stt_model, settings.llm_base_url, settings.llm_api_key
    )
    worker = Worker(db, ai, settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Chunks interrupted mid-processing by a restart go back in the queue.
        db.execute("UPDATE recordings SET mom_status = 'pending' WHERE mom_status = 'running'")
        task = asyncio.create_task(worker.run()) if settings.worker_enabled else None
        yield
        worker.stop()
        if task:
            await asyncio.wait([task], timeout=5)
        await ai.aclose()

    app = FastAPI(title="Yapper", lifespan=lifespan)
    app.state.db, app.state.worker, app.state.settings = db, worker, settings

    def auth(request: Request, token: str | None = Query(default=None)) -> None:
        header = request.headers.get("authorization", "")
        given = header[7:] if header.lower().startswith("bearer ") else (token or "")
        if not secrets.compare_digest(given.encode(), settings.token.encode()):
            raise HTTPException(status_code=401, detail="invalid token")

    def get_rec(rec_id: str) -> dict:
        rec = db.get_recording(rec_id)
        if not rec:
            raise HTTPException(status_code=404, detail="recording not found")
        return rec

    def summary(rec: dict) -> dict:
        counts = db.one(
            """SELECT COUNT(*) AS total,
                      SUM(status IN ('transcribed', 'done')) AS transcribed,
                      SUM(status = 'done') AS done,
                      SUM(status = 'error') AS errors,
                      COALESCE(MAX(start_ms + duration_ms), 0) AS audio_ms
               FROM chunks WHERE recording_id = ?""",
            (rec["id"],),
        ) or {}
        mom = loads(rec.get("mom_json"), None)
        return {
            "id": rec["id"],
            "title": rec.get("title") or (mom or {}).get("title") or "Untitled conversation",
            "started_at": rec["started_at"],
            "ended_at": rec.get("ended_at"),
            "language": rec["language"],
            "source": rec.get("source"),
            "device": rec.get("device"),
            "finished": bool(rec["finished"]),
            "duration_ms": rec.get("duration_ms") or counts.get("audio_ms") or 0,
            "expected_chunks": rec.get("expected_chunks"),
            "chunks": {
                "total": counts.get("total") or 0,
                "transcribed": counts.get("transcribed") or 0,
                "translated": counts.get("done") or 0,
                "errors": counts.get("errors") or 0,
            },
            "mom_status": rec["mom_status"],
            "mom_error": rec.get("mom_error"),
            "summary": (mom or {}).get("summary"),
        }

    # ---- health -------------------------------------------------------------

    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    @app.get("/api/ping", dependencies=[Depends(auth)])
    def ping():
        return {"ok": True, "time": time.time()}

    # ---- ingest (phone / extension) ----------------------------------------

    @app.post("/api/recordings", dependencies=[Depends(auth)])
    def create_recording(body: RecordingIn):
        if not ID_RE.match(body.id):
            raise HTTPException(status_code=400, detail="bad id")
        db.upsert_recording(body.model_dump())
        return summary(get_rec(body.id))

    @app.put("/api/recordings/{rec_id}/chunks/{seq}", dependencies=[Depends(auth)])
    async def upload_chunk(
        rec_id: str,
        seq: int,
        file: UploadFile = File(...),
        start_ms: int = Form(...),
        duration_ms: int = Form(...),
    ):
        rec = get_rec(rec_id)
        if seq < 0 or seq > 1_000_000 or start_ms < 0 or duration_ms < 0:
            raise HTTPException(status_code=400, detail="bad chunk numbers")
        folder = settings.audio_dir / rec_id
        folder.mkdir(parents=True, exist_ok=True)
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in {".m4a", ".mp4", ".webm", ".ogg", ".wav", ".mp3", ".flac"}:
            suffix = ".m4a"
        path = folder / f"chunk_{seq:06d}{suffix}"
        tmp = path.with_suffix(path.suffix + ".part")
        size = 0
        with tmp.open("wb") as out:
            while block := await file.read(1024 * 1024):
                size += len(block)
                if size > MAX_CHUNK_BYTES:
                    out.close()
                    tmp.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="chunk too large")
                out.write(block)
        existing = db.one("SELECT size, status FROM chunks WHERE recording_id = ? AND seq = ?", (rec_id, seq))
        if existing and existing["size"] == size and existing["status"] != "error":
            tmp.unlink(missing_ok=True)  # duplicate retry from the phone
            return {"seq": seq, "status": existing["status"], "duplicate": True}
        tmp.replace(path)
        db.execute(
            """INSERT INTO chunks (recording_id, seq, path, size, start_ms, duration_ms, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(recording_id, seq) DO UPDATE SET
                 path = excluded.path, size = excluded.size, start_ms = excluded.start_ms,
                 duration_ms = excluded.duration_ms, status = 'pending', attempts = 0,
                 next_attempt_at = 0, error = NULL, text = NULL, text_en = NULL, segments_json = NULL""",
            (rec_id, seq, str(path), size, start_ms, duration_ms, time.time()),
        )
        if rec["finished"] and rec["mom_status"] in ("done", "error"):
            db.execute("UPDATE recordings SET mom_status = 'pending', mom_attempts = 0 WHERE id = ?", (rec_id,))
        db.touch(rec_id)
        worker.wake()
        return {"seq": seq, "status": "pending"}

    @app.post("/api/recordings/{rec_id}/finish", dependencies=[Depends(auth)])
    def finish_recording(rec_id: str, body: FinishIn | None = None):
        rec = get_rec(rec_id)
        body = body or FinishIn()
        db.execute(
            """UPDATE recordings SET finished = 1,
                 ended_at = COALESCE(?, ended_at),
                 expected_chunks = COALESCE(?, expected_chunks),
                 duration_ms = COALESCE(?, duration_ms),
                 mom_status = CASE WHEN mom_status IN ('waiting', 'error') THEN 'pending' ELSE mom_status END,
                 mom_attempts = 0, mom_next_at = 0, updated_at = ?
               WHERE id = ?""",
            (body.ended_at, body.chunk_count, body.duration_ms, time.time(), rec["id"]),
        )
        worker.wake()
        return summary(get_rec(rec_id))

    # ---- dashboard API ------------------------------------------------------

    @app.get("/api/recordings", dependencies=[Depends(auth)])
    def list_recordings(q: str | None = None, limit: int = Query(default=100, le=500), offset: int = 0):
        if q:
            like = f"%{q}%"
            rows = db.all(
                """SELECT DISTINCT r.* FROM recordings r LEFT JOIN chunks c ON c.recording_id = r.id
                   WHERE r.title LIKE ? OR r.mom_json LIKE ? OR c.text LIKE ? OR c.text_en LIKE ?
                   ORDER BY r.started_at DESC LIMIT ? OFFSET ?""",
                (like, like, like, like, limit, offset),
            )
        else:
            rows = db.all("SELECT * FROM recordings ORDER BY started_at DESC LIMIT ? OFFSET ?", (limit, offset))
        return [summary(r) for r in rows]

    @app.get("/api/recordings/{rec_id}", dependencies=[Depends(auth)])
    def get_recording(rec_id: str):
        rec = get_rec(rec_id)
        chunks = [
            {
                "seq": c["seq"],
                "start_ms": c["start_ms"],
                "duration_ms": c["duration_ms"],
                "status": c["status"],
                "language": c["language"],
                "text": c["text"],
                "text_en": c["text_en"],
                "segments": loads(c["segments_json"], []),
                "error": c["error"],
            }
            for c in db.chunks(rec_id)
        ]
        done = {r["idx"]: bool(r["done"]) for r in db.all("SELECT idx, done FROM action_item_state WHERE recording_id = ?", (rec_id,))}
        mom = loads(rec.get("mom_json"), None)
        if mom:
            for i, item in enumerate(mom.get("action_items") or []):
                if isinstance(item, dict):
                    item["done"] = done.get(i, False)
        return {**summary(rec), "mom": mom, "chunk_list": chunks}

    @app.patch("/api/recordings/{rec_id}", dependencies=[Depends(auth)])
    def patch_recording(rec_id: str, body: RecordingPatch):
        get_rec(rec_id)
        if body.title is not None:
            db.execute("UPDATE recordings SET title = ? WHERE id = ?", (body.title.strip() or None, rec_id))
        if body.language is not None:
            db.execute("UPDATE recordings SET language = ? WHERE id = ?", (body.language, rec_id))
        return summary(get_rec(rec_id))

    @app.delete("/api/recordings/{rec_id}", dependencies=[Depends(auth)])
    def delete_recording(rec_id: str):
        get_rec(rec_id)
        db.execute("DELETE FROM chunks WHERE recording_id = ?", (rec_id,))
        db.execute("DELETE FROM action_item_state WHERE recording_id = ?", (rec_id,))
        db.execute("DELETE FROM recordings WHERE id = ?", (rec_id,))
        shutil.rmtree(settings.audio_dir / rec_id, ignore_errors=True)
        return {"ok": True}

    @app.post("/api/recordings/{rec_id}/retranscribe", dependencies=[Depends(auth)])
    def retranscribe(rec_id: str, only_failed: bool = False):
        get_rec(rec_id)
        cond = "AND status = 'error'" if only_failed else ""
        db.execute(
            f"UPDATE chunks SET status = 'pending', attempts = 0, next_attempt_at = 0, error = NULL WHERE recording_id = ? {cond}",
            (rec_id,),
        )
        db.execute(
            "UPDATE recordings SET mom_status = CASE WHEN finished = 1 THEN 'pending' ELSE 'waiting' END, mom_attempts = 0, mom_next_at = 0 WHERE id = ?",
            (rec_id,),
        )
        worker.wake()
        return summary(get_rec(rec_id))

    @app.post("/api/recordings/{rec_id}/minutes", dependencies=[Depends(auth)])
    def regenerate_minutes(rec_id: str):
        get_rec(rec_id)
        db.execute(
            "UPDATE recordings SET finished = 1, mom_status = 'pending', mom_attempts = 0, mom_next_at = 0, mom_error = NULL WHERE id = ?",
            (rec_id,),
        )
        worker.wake()
        return summary(get_rec(rec_id))

    @app.put("/api/recordings/{rec_id}/action-items/{idx}", dependencies=[Depends(auth)])
    def set_action_item(rec_id: str, idx: int, body: ActionItemIn):
        get_rec(rec_id)
        db.execute(
            "INSERT INTO action_item_state (recording_id, idx, done) VALUES (?, ?, ?) "
            "ON CONFLICT(recording_id, idx) DO UPDATE SET done = excluded.done",
            (rec_id, idx, int(body.done)),
        )
        return {"ok": True}

    @app.get("/api/action-items", dependencies=[Depends(auth)])
    def action_items(include_done: bool = False):
        """Every action item across all minutes — the feed for a future planning agent."""
        done = {(r["recording_id"], r["idx"]): bool(r["done"]) for r in db.all("SELECT * FROM action_item_state")}
        out = []
        for rec in db.all("SELECT * FROM recordings WHERE mom_json IS NOT NULL ORDER BY started_at DESC"):
            mom = loads(rec["mom_json"], {})
            for i, item in enumerate(mom.get("action_items") or []):
                if not isinstance(item, dict):
                    continue
                is_done = done.get((rec["id"], i), False)
                if is_done and not include_done:
                    continue
                out.append({
                    **item,
                    "done": is_done,
                    "idx": i,
                    "recording_id": rec["id"],
                    "recording_title": rec["title"] or mom.get("title"),
                    "started_at": rec["started_at"],
                })
        return out

    @app.get("/api/recordings/{rec_id}/chunks/{seq}/audio", dependencies=[Depends(auth)])
    def chunk_audio(rec_id: str, seq: int):
        row = db.one("SELECT path FROM chunks WHERE recording_id = ? AND seq = ?", (rec_id, seq))
        if not row or not Path(row["path"]).is_file():
            raise HTTPException(status_code=404, detail="audio not found")
        return FileResponse(row["path"], media_type="audio/mp4")

    @app.get("/api/recordings/{rec_id}/export.md", dependencies=[Depends(auth)], response_class=PlainTextResponse)
    def export_markdown(rec_id: str):
        data = get_recording(rec_id)
        mom = data.get("mom") or {}
        md = [f"# {data['title']}", "", f"*{data['started_at']} · {fmt_ts(data['duration_ms'])}*", ""]

        def section(name: str, items: list) -> None:
            if items:
                md.extend([f"## {name}", *[f"- {x}" for x in items], ""])

        if mom.get("summary"):
            md.extend(["## Summary", mom["summary"], ""])
        section("Participants", mom.get("participants") or [])
        section("Key points", mom.get("key_points") or [])
        section("Decisions", mom.get("decisions") or [])
        items = mom.get("action_items") or []
        if items:
            md.append("## Action items")
            for it in items:
                if isinstance(it, dict):
                    box = "x" if it.get("done") else " "
                    extra = ", ".join(x for x in [it.get("owner"), it.get("due")] if x)
                    md.append(f"- [{box}] {it.get('task', '')}" + (f" ({extra})" if extra else ""))
            md.append("")
        section("Open questions", mom.get("open_questions") or [])
        section("Follow-ups", mom.get("follow_ups") or [])
        md.extend(["## Transcript", ""])
        for c in data["chunk_list"]:
            if c["text"]:
                md.append(f"**[{fmt_ts(c['start_ms'])}]** {c['text']}")
                if c["text_en"] and c["text_en"] != c["text"]:
                    md.append(f"> {c['text_en']}")
                md.append("")
        return "\n".join(md)

    @app.get("/api/dictionary", dependencies=[Depends(auth)])
    def get_dictionary():
        return {"terms": db.dictionary_terms()}

    @app.put("/api/dictionary", dependencies=[Depends(auth)])
    def put_dictionary(body: TermsIn):
        terms = sorted({t.strip() for t in body.terms if t.strip()})
        db.execute("DELETE FROM dictionary")
        for t in terms:
            db.execute("INSERT INTO dictionary (term) VALUES (?)", (t[:80],))
        return {"terms": terms}

    @app.get("/api/status", dependencies=[Depends(auth)])
    def status():
        q = db.one(
            """SELECT SUM(status = 'pending') AS pending, SUM(status = 'transcribed') AS translating,
                      SUM(status = 'error') AS errors FROM chunks"""
        ) or {}
        now = time.time()
        return {
            "queue": {k: v or 0 for k, v in q.items()},
            "stt_blocked_for_s": max(0, round(worker.stt_blocked_until - now)),
            "models_blocked": {m: round(t - now) for m, t in worker.model_blocked_until.items() if t > now},
            "stt_model": settings.stt_model,
            "mom_models": settings.mom_models,
        }

    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="dashboard")
    return app


def run() -> None:  # pragma: no cover
    import argparse

    import uvicorn

    parser = argparse.ArgumentParser(description="Run the Yapper server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    uvicorn.run(create_app(), host=args.host, port=args.port)


if __name__ == "__main__":  # pragma: no cover
    run()
