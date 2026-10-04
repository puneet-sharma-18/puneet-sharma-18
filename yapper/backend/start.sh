#!/usr/bin/env bash
# Start the Yapper server without Docker (macOS / Linux).
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created backend/.env - open it, fill in YAPPER_TOKEN and GROQ_API_KEY, then run this again."
  exit 1
fi
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q -r requirements.txt
exec .venv/bin/python -m yapper.main --host 0.0.0.0 --port "${PORT:-8000}"
