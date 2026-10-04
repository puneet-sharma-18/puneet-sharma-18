# Yapper

A personal voice system you own. Phase 1 is a **conversation and meeting recorder** that:

- records from your phone with **no time limit** (1, 2, 3+ hours), started from a floating button over any app;
- transcribes **Hindi, English and Marathi**, including when they are mixed mid-sentence;
- gives you an **English version** of everything said;
- writes **Minutes of Meeting**: summary, decisions, action items with owners and due dates, open questions and a timeline;
- shows it all on a **dashboard** with search, audio playback and an action-item list across all meetings.

It runs on your own PC and uses Groq's free tier, so the running cost is ₹0.

```
 Phone (Yapper APK)                         Your PC (always the source of truth)
 ┌───────────────────────────┐   Tailscale  ┌──────────────────────────────────────────┐
 │ floating button / QS tile │  (private,   │ Yapper server (FastAPI + SQLite)         │
 │ records 60-second chunks  │──encrypted)─▶│  • stores every chunk                    │
 │ uploads each chunk, keeps │              │  • Groq Whisper large-v3 → transcript    │
 │ them if offline           │              │  • Groq LLM → English + minutes          │
 └───────────────────────────┘              │  • dashboard at http://<pc>:8000         │
                                            └──────────────────────────────────────────┘
```

## Why it never loses a long recording

| Risk | What Yapper does |
|---|---|
| A 3-hour file is huge and fragile | Audio is saved in 60-second files. A crash loses at most the current minute. |
| Android kills background apps | Recording runs as a microphone foreground service with a permanent notification and a wake lock, and has a battery-optimisation exemption. |
| No internet or PC is off | Chunks queue on the phone and upload automatically later. Nothing is deleted until the server has it. |
| Groq rate limits | Each chunk is transcribed separately, well under the free limits. On a limit the server waits and retries, and switches model if a daily cap is hit. |
| Another app takes the mic (a call) | Recording keeps running and the notification says it is paused by another app. |
| Server restarts | All work state is in SQLite and resumes where it stopped. |

## Setup (about 20 minutes, one time)

### 1. Get a free Groq key
Sign up at <https://console.groq.com> (no card needed) and create an API key.

### 2. Run the server on your PC
You need either **Docker Desktop**, or **Python 3.11+**.

```bash
git clone <this repo> yapper && cd yapper
cp backend/.env.example backend/.env      # Windows: copy backend\.env.example backend\.env
# edit backend/.env: set YAPPER_TOKEN (any long random string) and GROQ_API_KEY
```

Then start it with either:

- Docker: `docker compose up -d --build`
- Without Docker: `backend/start.sh` (macOS/Linux) or `powershell -ExecutionPolicy Bypass -File backend\start.ps1` (Windows)

Open <http://localhost:8000> and log in with your `YAPPER_TOKEN`.

### 3. Connect the phone to the PC with Tailscale (free)
1. Install Tailscale on the PC (<https://tailscale.com/download>) and on the phone (Play Store), and sign in with the same account on both.
2. In the Tailscale app on the PC, copy the PC's address, like `100.101.102.103`, or use its name, like `my-pc`.
3. The server URL for the phone is `http://100.101.102.103:8000`. Tailscale encrypts the connection, and the server is not on the public internet.
4. Optional, for HTTPS: run `tailscale serve --bg 8000` on the PC and use `https://my-pc.<your-tailnet>.ts.net`.
5. Keep the PC from sleeping while you want minutes generated. If it sleeps, the phone simply holds the audio until it wakes.

### 4. Install the app on the Galaxy S24 Ultra
1. Download `yapper.apk` from the latest GitHub release (`apk-latest`), or from the **Actions → android** run artifacts.
2. Open it on the phone and allow "Install unknown apps" for your browser or Files app when asked.
3. Open Yapper and work through the setup checklist: microphone, notifications, display over other apps and the battery exemption.
4. **Samsung:** go to Settings → Battery → Background usage limits → **Never sleeping apps** → add Yapper. Without this, One UI may freeze the app.
5. Enter the server URL and token, then tap **Test connection**.
6. Turn on **Show floating button**.

### 5. Use it
Tap the floating button (or the Quick Settings tile) to start. The button turns red with a running timer and a level ring, so you can tell it is recording without opening anything. Tap twice to stop. The transcript shows up on the dashboard as you go, and the minutes appear a few minutes after you stop.

Tips:
- In **Settings → Personal dictionary** on the dashboard, add names, brands and jargon so they are spelt right.
- If a conversation is mostly Marathi, choose **Marathi** before starting; auto-detection sometimes picks Hindi.
- Groq's free tier allows about **8 hours of audio per day**, which is plenty for daily meetings.

## Hosting options

| Option | Cost | Notes |
|---|---|---|
| **Own PC + Tailscale** (default) | ₹0 | Simplest. Minutes are produced while the PC is on. |
| Oracle Cloud Always Free VM | ₹0 | Always on. Run the same `docker compose` there and install Tailscale on it. |
| Small VPS (Hetzner, DigitalOcean) | about ₹400/month | Same as above, more reliable. |
| Vercel | — | **Not suitable for the server.** Serverless functions have short time limits, small upload limits and no disk, so they can't hold recordings or run the background worker. |

## Limits to know
- Android does **not** let apps record the other person's voice in phone or WhatsApp calls. In-person conversations and speakerphone work. Online meetings will be covered by the Chrome extension (Phase 3).
- Speaker labels ("Person A / Person B") are not in Phase 1.
- Audio is sent to Groq for transcription. To keep everything local, point `STT_BASE_URL` at a self-hosted Whisper server running on a GPU.

## Repository layout
```
backend/   FastAPI server, background worker, dashboard (backend/yapper/static), tests
android/   Kotlin app: recorder service, floating button, uploader, setup screens
docs/      research notes and roadmap
```

## API (for the future agent)
All endpoints take `Authorization: Bearer <YAPPER_TOKEN>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/recordings?q=` | List or search conversations |
| GET | `/api/recordings/{id}` | Full transcript, English text and minutes |
| GET | `/api/action-items` | Open action items from all minutes (feed for a planning agent) |
| PUT | `/api/recordings/{id}/action-items/{idx}` | Mark an item done |
| GET | `/api/recordings/{id}/export.md` | Minutes and transcript as Markdown |
| POST | `/api/recordings` · PUT `.../chunks/{seq}` · POST `.../finish` | Ingest, used by the phone and the future Chrome extension |

## Development
```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```
The Android build is described in [android/README.md](android/README.md). The roadmap is in [docs/ROADMAP.md](docs/ROADMAP.md).
