"""Background worker: transcribe chunks as they arrive, translate to English, then write the minutes.

Everything is driven by rows in SQLite, so a restart simply picks up where it left off.
Nothing is ever dropped because of a provider failure: transient errors back off and retry.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from pathlib import Path
from typing import Any

from .ai import AIClient, AIError, PermanentAIError, RateLimited, parse_json
from .config import Settings
from .db import DB

log = logging.getLogger("yapper.worker")

DEVANAGARI = re.compile(r"[ऀ-ॿ]")
MAX_BACKOFF = 30 * 60
# Keep each LLM request comfortably under Groq's free-tier tokens-per-minute limits.
WINDOW_CHARS = 10_000


def fmt_ts(ms: int) -> str:
    s = max(0, int(ms // 1000))
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


class ModelsBusy(AIError):
    def __init__(self, until: float):
        super().__init__(f"all models rate limited until {time.ctime(until)}")
        self.until = until


TRANSLATE_SYSTEM = (
    "You translate transcripts of spoken conversations from India. The speech mixes Hindi, Marathi and "
    "English (often mid-sentence, sometimes in Roman script). Translate into natural, faithful English. "
    "Keep names, numbers, amounts, dates and technical terms exactly. Do not summarise, do not add "
    "commentary, do not answer questions in the text. Output only the English translation."
)

NOTES_SYSTEM = (
    "You are an expert meeting note-taker. You will get one part of a longer conversation transcript "
    "with [hh:mm:ss] timestamps. Write dense bullet notes that preserve every fact, number, name, "
    "decision, commitment (who will do what, by when), question and disagreement, each with its "
    "timestamp. No intro, just bullets."
)

MOM_SYSTEM = """You write Minutes of Meeting (MoM) from conversation transcripts or notes.
The conversation may mix Hindi, Marathi and English; always write the minutes in clear English.
Return ONLY a JSON object with exactly these keys:
{
  "title": "short descriptive title (max 8 words)",
  "summary": "3-6 sentence executive summary",
  "participants": ["names or roles mentioned; [] if unknown"],
  "key_points": ["important points discussed"],
  "decisions": ["decisions that were made"],
  "action_items": [{"task": "...", "owner": "person or 'Me' or 'Unassigned'", "due": "date/time as said, or ''", "priority": "high|medium|low"}],
  "open_questions": ["unresolved questions"],
  "follow_ups": ["things to check or schedule later"],
  "topics": [{"time": "hh:mm:ss", "topic": "what was discussed from this point"}]
}
Be faithful to the transcript; never invent facts. Use [] for empty lists."""


class Worker:
    def __init__(self, db: DB, ai: AIClient, settings: Settings):
        self.db = db
        self.ai = ai
        self.settings = settings
        self.stt_blocked_until = 0.0
        self.model_blocked_until: dict[str, float] = {}
        self._wake = asyncio.Event()
        self._stopping = False

    def wake(self) -> None:
        self._wake.set()

    def stop(self) -> None:
        self._stopping = True
        self._wake.set()

    async def run(self) -> None:
        log.info("worker started")
        while not self._stopping:
            try:
                did_work = await self.step()
            except Exception:  # never let the loop die
                log.exception("worker step crashed")
                did_work = False
            if not did_work:
                self._wake.clear()
                try:
                    await asyncio.wait_for(self._wake.wait(), timeout=5)
                except asyncio.TimeoutError:
                    pass

    async def step(self) -> bool:
        now = time.time()
        if now >= self.stt_blocked_until:
            chunk = self.db.one(
                "SELECT * FROM chunks WHERE status = 'pending' AND next_attempt_at <= ? "
                "ORDER BY created_at, seq LIMIT 1",
                (now,),
            )
            if chunk:
                await self.transcribe_chunk(chunk)
                return True

        if self._any_model_free(self.settings.translate_models):
            chunk = self.db.one(
                "SELECT * FROM chunks WHERE status = 'transcribed' AND next_attempt_at <= ? "
                "ORDER BY created_at, seq LIMIT 1",
                (now,),
            )
            if chunk:
                await self.translate_chunk(chunk)
                return True

        if self._any_model_free(self.settings.mom_models):
            rec = self.db.one(
                """
                SELECT r.* FROM recordings r
                WHERE r.finished = 1 AND r.mom_status = 'pending' AND r.mom_next_at <= ?
                  AND NOT EXISTS (SELECT 1 FROM chunks c WHERE c.recording_id = r.id AND c.status = 'pending')
                  AND (r.expected_chunks IS NULL
                       OR (SELECT COUNT(*) FROM chunks c WHERE c.recording_id = r.id) >= r.expected_chunks
                       OR r.updated_at < ?)
                ORDER BY r.updated_at LIMIT 1
                """,
                # If some chunks never arrive, still write minutes 30 min after the last activity.
                (now, now - 1800),
            )
            if rec:
                await self.generate_mom(rec)
                return True
        return False

    # ---- speech to text ---------------------------------------------------

    def _prompt_for(self, chunk: dict[str, Any]) -> str:
        parts = []
        terms = self.db.dictionary_terms()
        if terms:
            parts.append(", ".join(terms)[:200])
        prev = self.db.one(
            "SELECT text FROM chunks WHERE recording_id = ? AND seq < ? AND text IS NOT NULL ORDER BY seq DESC LIMIT 1",
            (chunk["recording_id"], chunk["seq"]),
        )
        if prev and prev["text"]:
            parts.append(prev["text"][-150:])
        return " ".join(parts).strip()

    async def transcribe_chunk(self, chunk: dict[str, Any]) -> None:
        rec = self.db.get_recording(chunk["recording_id"]) or {}
        key = (chunk["recording_id"], chunk["seq"])
        try:
            result = await self.ai.transcribe(Path(chunk["path"]), rec.get("language"), self._prompt_for(chunk))
        except RateLimited as e:
            self.stt_blocked_until = time.time() + e.retry_after
            log.warning("speech-to-text rate limited for %.0fs", e.retry_after)
            return
        except PermanentAIError as e:
            self._chunk_failed(chunk, str(e), permanent=True)
            return
        except AIError as e:
            self._chunk_failed(chunk, str(e), permanent=False)
            return

        offset = chunk["start_ms"] / 1000.0
        segments = [
            {"start": round(s["start"] + offset, 2), "end": round(s["end"] + offset, 2), "text": s["text"]}
            for s in result.segments
        ]
        needs_translation = self.settings.translate and bool(result.text) and (
            bool(DEVANAGARI.search(result.text)) or (result.language or "english").lower() not in ("english", "en")
        )
        self.db.execute(
            """UPDATE chunks SET status = ?, language = ?, text = ?, text_en = ?, segments_json = ?,
               error = NULL, attempts = 0, next_attempt_at = 0 WHERE recording_id = ? AND seq = ?""",
            (
                "transcribed" if needs_translation else "done",
                result.language,
                result.text,
                None if needs_translation else result.text,
                json.dumps(segments, ensure_ascii=False),
                *key,
            ),
        )
        self.db.touch(chunk["recording_id"])
        log.info("transcribed %s#%s (%s, %d chars)", *key, result.language, len(result.text))

    def _chunk_failed(self, chunk: dict[str, Any], error: str, permanent: bool) -> None:
        attempts = chunk["attempts"] + 1
        if permanent and attempts >= 3:
            status, next_at = "error", 0.0
        else:
            status, next_at = chunk["status"], time.time() + min(30 * 2**attempts, MAX_BACKOFF)
        self.db.execute(
            "UPDATE chunks SET status = ?, attempts = ?, next_attempt_at = ?, error = ? WHERE recording_id = ? AND seq = ?",
            (status, attempts, next_at, error[:500], chunk["recording_id"], chunk["seq"]),
        )
        log.warning("chunk %s#%s failed (attempt %d): %s", chunk["recording_id"], chunk["seq"], attempts, error)

    # ---- LLM helpers ------------------------------------------------------

    def _any_model_free(self, models: list[str]) -> bool:
        now = time.time()
        return any(self.model_blocked_until.get(m, 0) <= now for m in models)

    async def llm(self, models: list[str], system: str, user: str, json_mode: bool = False, max_tokens: int = 4096) -> str:
        """Call the first available model; wait out short rate limits, fall over on daily ones."""
        last_error: Exception | None = None
        for model in models:
            for _ in range(4):
                if self.model_blocked_until.get(model, 0) > time.time():
                    break
                try:
                    return await self.ai.chat(model, system, user, json_mode=json_mode, max_tokens=max_tokens)
                except RateLimited as e:
                    if e.daily or e.retry_after > 120:
                        self.model_blocked_until[model] = time.time() + max(e.retry_after, 600)
                        log.warning("model %s limited for %.0fs", model, e.retry_after)
                        break
                    await asyncio.sleep(e.retry_after + 1)
                except PermanentAIError as e:  # e.g. model decommissioned or JSON mode unsupported
                    last_error = e
                    self.model_blocked_until[model] = time.time() + 3600
                    break
        if last_error and not self._any_model_free(models):
            raise last_error
        until = min((self.model_blocked_until.get(m, 0) for m in models), default=time.time() + 60)
        raise ModelsBusy(max(until, time.time() + 30))

    # ---- translation ------------------------------------------------------

    async def translate_chunk(self, chunk: dict[str, Any]) -> None:
        key = (chunk["recording_id"], chunk["seq"])
        try:
            text_en = (await self.llm(self.settings.translate_models, TRANSLATE_SYSTEM, chunk["text"], max_tokens=2048)).strip()
        except ModelsBusy:
            return
        except PermanentAIError as e:
            # Keep the original text; the minutes can still be written from it.
            self.db.execute("UPDATE chunks SET status = 'done', error = ? WHERE recording_id = ? AND seq = ?", (str(e)[:500], *key))
            return
        except AIError as e:
            self._chunk_failed(chunk, str(e), permanent=False)
            return
        self.db.execute(
            "UPDATE chunks SET status = 'done', text_en = ?, error = NULL, attempts = 0 WHERE recording_id = ? AND seq = ?",
            (text_en, *key),
        )
        self.db.touch(chunk["recording_id"])

    # ---- minutes of meeting -----------------------------------------------

    def transcript_lines(self, rec_id: str) -> list[str]:
        lines = []
        for c in self.db.chunks(rec_id):
            text = (c["text_en"] or c["text"] or "").strip()
            if text:
                lines.append(f"[{fmt_ts(c['start_ms'])}] {text}")
        return lines

    @staticmethod
    def windows(lines: list[str], limit: int = WINDOW_CHARS) -> list[str]:
        out, cur, size = [], [], 0
        for line in lines:
            if cur and size + len(line) > limit:
                out.append("\n".join(cur))
                cur, size = [], 0
            cur.append(line[: limit])
            size += len(line) + 1
        if cur:
            out.append("\n".join(cur))
        return out

    async def condense(self, text_lines: list[str]) -> str:
        """Map-reduce until the material fits one request."""
        parts = self.windows(text_lines)
        while len(parts) > 1:
            notes = []
            for i, part in enumerate(parts, 1):
                notes.append(
                    await self.llm(self.settings.mom_models, NOTES_SYSTEM, f"Part {i} of {len(parts)}:\n\n{part}", max_tokens=1500)
                )
            joined = "\n".join(n.strip() for n in notes)
            parts = self.windows(joined.splitlines())
        return parts[0] if parts else ""

    async def generate_mom(self, rec: dict[str, Any]) -> None:
        rec_id = rec["id"]
        self.db.execute("UPDATE recordings SET mom_status = 'running' WHERE id = ?", (rec_id,))
        try:
            lines = self.transcript_lines(rec_id)
            if not lines:
                mom = {"title": rec.get("title") or "Empty recording", "summary": "No speech was detected in this recording."}
            else:
                material = await self.condense(lines)
                header = (
                    f"Recording started: {rec['started_at']}\n"
                    f"Duration: {fmt_ts(rec.get('duration_ms') or 0)}\n"
                    f"User-given title: {rec.get('title') or '(none)'}\n\n"
                )
                reply = await self.llm(self.settings.mom_models, MOM_SYSTEM, header + material, json_mode=True)
                mom = parse_json(reply)
        except ModelsBusy as e:
            self.db.execute("UPDATE recordings SET mom_status = 'pending', mom_next_at = ? WHERE id = ?", (e.until, rec_id))
            return
        except AIError as e:
            attempts = rec["mom_attempts"] + 1
            status = "error" if attempts >= 6 else "pending"
            self.db.execute(
                "UPDATE recordings SET mom_status = ?, mom_attempts = ?, mom_error = ?, mom_next_at = ? WHERE id = ?",
                (status, attempts, str(e)[:500], time.time() + min(60 * 2**attempts, MAX_BACKOFF), rec_id),
            )
            log.warning("minutes for %s failed: %s", rec_id, e)
            return
        self.db.execute(
            """UPDATE recordings SET mom_status = 'done', mom_json = ?, mom_error = NULL, mom_attempts = 0,
               title = COALESCE(NULLIF(title, ''), ?) WHERE id = ?""",
            (json.dumps(mom, ensure_ascii=False), mom.get("title"), rec_id),
        )
        log.info("minutes ready for %s", rec_id)
