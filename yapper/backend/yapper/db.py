"""SQLite storage. Single-user, so one connection guarded by a lock is plenty."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    title TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    language TEXT NOT NULL DEFAULT 'auto',
    source TEXT,
    device TEXT,
    finished INTEGER NOT NULL DEFAULT 0,
    expected_chunks INTEGER,
    duration_ms INTEGER,
    mom_status TEXT NOT NULL DEFAULT 'waiting',   -- waiting | pending | running | done | error
    mom_json TEXT,
    mom_error TEXT,
    mom_attempts INTEGER NOT NULL DEFAULT 0,
    mom_next_at REAL NOT NULL DEFAULT 0,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
    recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',       -- pending | transcribed | done | error
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at REAL NOT NULL DEFAULT 0,
    language TEXT,
    text TEXT,
    text_en TEXT,
    segments_json TEXT,
    error TEXT,
    created_at REAL NOT NULL,
    PRIMARY KEY (recording_id, seq)
);
CREATE TABLE IF NOT EXISTS dictionary (
    term TEXT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS action_item_state (
    recording_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (recording_id, idx)
);
"""


class DB:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        with self._lock:
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
            self._conn.executescript(SCHEMA)

    def execute(self, sql: str, params: tuple | dict = ()) -> sqlite3.Cursor:
        with self._lock:
            return self._conn.execute(sql, params)

    def one(self, sql: str, params: tuple | dict = ()) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(sql, params).fetchone()
            return dict(row) if row else None

    def all(self, sql: str, params: tuple | dict = ()) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(r) for r in self._conn.execute(sql, params).fetchall()]

    # ---- recordings -------------------------------------------------------

    def upsert_recording(self, rec: dict[str, Any]) -> None:
        now = time.time()
        self.execute(
            """
            INSERT INTO recordings (id, title, started_at, language, source, device, created_at, updated_at)
            VALUES (:id, :title, :started_at, :language, :source, :device, :now, :now)
            ON CONFLICT(id) DO UPDATE SET
                title = COALESCE(recordings.title, excluded.title),
                updated_at = excluded.updated_at
            """,
            {**rec, "now": now},
        )

    def get_recording(self, rec_id: str) -> dict[str, Any] | None:
        return self.one("SELECT * FROM recordings WHERE id = ?", (rec_id,))

    def touch(self, rec_id: str) -> None:
        self.execute("UPDATE recordings SET updated_at = ? WHERE id = ?", (time.time(), rec_id))

    def chunks(self, rec_id: str) -> list[dict[str, Any]]:
        return self.all("SELECT * FROM chunks WHERE recording_id = ? ORDER BY seq", (rec_id,))

    def dictionary_terms(self) -> list[str]:
        return [r["term"] for r in self.all("SELECT term FROM dictionary ORDER BY term")]


def loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default
