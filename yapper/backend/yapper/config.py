"""Runtime configuration, read from environment variables (and an optional .env file)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader so the server runs without extra dependencies."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


def _bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    token: str
    data_dir: Path
    stt_base_url: str
    stt_api_key: str
    stt_model: str
    llm_base_url: str
    llm_api_key: str
    # Models are tried in order; on a daily-limit 429 the next one is used.
    translate_models: list[str] = field(default_factory=list)
    mom_models: list[str] = field(default_factory=list)
    translate: bool = True
    worker_enabled: bool = True

    @property
    def db_path(self) -> Path:
        return self.data_dir / "yapper.db"

    @property
    def audio_dir(self) -> Path:
        return self.data_dir / "audio"


def load_settings() -> Settings:
    _load_dotenv(Path(os.environ.get("YAPPER_ENV_FILE", ".env")))
    groq_key = os.environ.get("GROQ_API_KEY", "")
    groq_url = "https://api.groq.com/openai/v1"
    token = os.environ.get("YAPPER_TOKEN", "")
    if not token:
        raise RuntimeError("YAPPER_TOKEN is not set. Put a long random string in backend/.env")
    data_dir = Path(os.environ.get("YAPPER_DATA_DIR", "data")).resolve()
    return Settings(
        token=token,
        data_dir=data_dir,
        stt_base_url=os.environ.get("STT_BASE_URL", groq_url).rstrip("/"),
        stt_api_key=os.environ.get("STT_API_KEY", groq_key),
        stt_model=os.environ.get("STT_MODEL", "whisper-large-v3"),
        llm_base_url=os.environ.get("LLM_BASE_URL", groq_url).rstrip("/"),
        llm_api_key=os.environ.get("LLM_API_KEY", groq_key),
        translate_models=_csv(
            os.environ.get(
                "TRANSLATE_MODELS",
                "llama-3.3-70b-versatile,openai/gpt-oss-120b,meta-llama/llama-4-scout-17b-16e-instruct",
            )
        ),
        mom_models=_csv(
            os.environ.get(
                "MOM_MODELS",
                "openai/gpt-oss-120b,llama-3.3-70b-versatile,meta-llama/llama-4-scout-17b-16e-instruct",
            )
        ),
        translate=_bool(os.environ.get("TRANSLATE", "true")),
        worker_enabled=_bool(os.environ.get("YAPPER_WORKER", "true")),
    )
