# Personal Voice Assistant: research notes

Goal: build a self-owned version of Wispr Flow (voice dictation into any app) plus a long-running
conversation/meeting recorder that produces Minutes of Meeting (MoM). Languages: Hindi, English and
Marathi, including mixed speech. Keep third-party costs as close to zero as possible.

## 1. What Wispr Flow does (the benchmark)

Note: wisprflow.ai is blocked from the build environment, so this was gathered from its docs,
changelog and reviews.

| Feature | What it does | Include in ours? |
|---|---|---|
| Dictation anywhere | Hotkey (desktop) or floating bubble (Android) above any text field. Speak, and clean text is inserted. | Yes, Phase 2 |
| Android floating bubble | Shows up only when a text field is focused; tap to dictate. No need to switch keyboards. Android 13+. | Yes |
| AI auto-edit | Auto punctuation, numbered lists, removes filler words ("um", "uh"), applies self-corrections ("at 5, no, 6" becomes "at 6") | Yes (LLM pass) |
| 100+ languages, switch mid-sentence | Language is detected automatically | Hindi, English, Marathi + mixes |
| Personal dictionary | Learns names, jargon and acronyms | Yes |
| Snippets | A voice shortcut expands to saved text ("my calendar link") | Yes |
| Styles / tones | Formal vs casual, per app | Later |
| Command mode (Pro) | Select text and say "make this professional" or "turn into bullets" | Later |
| Whisper mode | Picks up low-volume speech | Mic gain + VAD tuning |
| Pricing | Free tier is limited; Pro is $15/month | We pay $0 to about $2/month |

Wispr Flow does **not** record meetings or write MoM. That part is new and is the bigger part of this system.

## 2. Proposed system

```
 ┌──────────── Android APK (Kotlin) ─────────────┐        ┌────────── Backend (self-hosted) ──────────┐
 │ A. Dictation bubble                            │        │ FastAPI                                    │
 │    AccessibilityService + overlay              │──────▶ │  /dictate  → STT → cleanup LLM → text      │
 │ B. Meeting recorder                            │        │  /chunks   → store → queue                 │
 │    overlay start/stop button                   │ chunks │ Worker: STT per chunk → stitch →           │
 │    Foreground service (type=microphone)        │──────▶ │  diarize → English translation → MoM       │
 │    writes 30–60 s Opus chunks to disk          │ (retry)│ Postgres/SQLite + audio on disk            │
 │    WorkManager upload queue, works offline     │        └─────────────┬──────────────────────────────┘
 └────────────────────────────────────────────────┘                      │
 ┌──── Chrome extension (Phase 3, MV3) ────┐                     ┌────────▼────────┐
 │ tabCapture (Meet/Zoom tab) + mic mixed  │────── chunks ─────▶ │ Web dashboard    │
 │ in offscreen document, chunked upload   │                     │ transcripts, MoM,│
 └─────────────────────────────────────────┘                     │ search, actions  │
                                                                 └──────────────────┘
```

### How recordings with no time limit work
- Record into **rolling chunk files** (for example 60 s of Opus at 16 kHz, about 0.5 MB per minute)
  instead of one big file. A 3-hour meeting is about 180 small files, so a crash loses at most one chunk.
- Run a **foreground service with `foregroundServiceType="microphone"`** and keep a persistent
  notification. It is never killed for running long. Unlike `dataSync`, the microphone type has no
  6-hour cap.
- Ask for an exemption from battery optimisation, and add a short guide for OEM battery settings
  (Xiaomi, Oppo, Vivo and OnePlus aggressively kill background apps).
- Each chunk is uploaded on its own with retry (WorkManager), so recording keeps working with no
  network and syncs later.
- Handle audio-focus loss (an incoming call): pause, then resume automatically. Show a small
  overlay with a live timer and a level meter so you can tell it is working without opening the app.
- Server-side transcription also runs per chunk, so a 3-hour meeting is never sent as one request.
  The transcript is stitched together with a little overlap between chunks.

### Android constraints to know about
- The Android 14+ microphone foreground service needs the `RECORD_AUDIO` permission and must be
  started while the app or its overlay is visible. Android 15 only lets an app holding
  `SYSTEM_ALERT_WINDOW` start the service from the background if its overlay is showing. Our
  bubble satisfies this.
- **Android cannot capture the other person's audio in phone or WhatsApp calls.** In-person
  conversations and speakerphone work fine. Online meetings on a laptop are what the Chrome
  extension covers.
- The dictation bubble needs Accessibility permission to detect text fields and insert text.
  This is fine for a sideloaded personal APK. It would get scrutiny on the Play Store.

## 3. Speech-to-text options (Hindi / English / Marathi)

| Option | Cost | Quality for Hi/En/Mr | Notes |
|---|---|---|---|
| **Groq Whisper large-v3 (API)** | Free tier: about 8 h/day (28,800 audio-s/day, 7,200/h). Paid tier: $0.04–0.11/h | Good for Hindi and Hinglish, fair for Marathi | Very fast. Good default for dictation and meetings. |
| **Sarvam Saaras v3 (API)** | ₹1.5/min (about ₹90/h), ₹1,000 free credit | Best for Indian languages and code-mixing; has diarization | Use as a paid fallback for important meetings only |
| **Self-hosted faster-whisper large-v3** | ₹0, but needs an NVIDIA GPU (a laptop or PC with about 6 GB+ VRAM) | Same as Groq | Fully private, no limits |
| **AI4Bharat IndicConformer** (open, permissive license) | ₹0 self-hosted | Strong for Marathi and Hindi | Can be a Marathi-specific pass |
| Whisper Hindi2Hinglish (Oriserve), Shunya zero-stt-hinglish | ₹0 self-hosted | Built for Hinglish | Options to try later |
| On-device whisper.cpp | ₹0 | Only small models fit on a phone, which is weak for Marathi | Not recommended as the main engine |

**Recommendation:** a pluggable STT layer. Default is Groq Whisper (free), a self-hosted
faster-whisper/IndicConformer can be switched in when a GPU machine is available, and Sarvam is an
optional premium switch.

**"English so it doesn't break":** store the original transcript in the spoken script, Hindi and
Marathi in Devanagari and English as-is, **plus** an LLM-generated English version. The MoM is
always written in English.

**Speaker labels:** pyannote (self-hosted, free) on the server after recording ends, or Sarvam
batch diarization when paying.

## 4. LLM for cleanup, translation and MoM
Options with a free or very cheap tier: Groq-hosted Llama/Qwen (free tier), Google Gemini Flash
(free tier), or local Ollama on your own machine. Keep it pluggable so the later "plan my day"
agent can use any model.
MoM template: summary, decisions, action items (owner and due date), open questions, follow-ups,
and key quotes. Action items get stored as structured data so a future agent can schedule them.

## 5. Hosting with almost zero cost
- **Option A (₹0):** run the backend on your own laptop or PC with Docker and connect the phone
  over **Tailscale** (free) so it works from anywhere. The phone queues chunks while the PC is off.
- **Option B (about ₹0–500/month):** an Oracle Cloud Always-Free ARM VM or a small Hetzner VPS
  running Docker Compose. The STT and LLM work goes to free API tiers, so no GPU is needed.
- Build the APK for free with GitHub Actions and sideload it.

## 6. Suggested phases
1. **Phase 1, meeting recorder MVP:** Android recorder (overlay, foreground service, chunks,
   offline queue), backend (ingest, Groq STT, English translation, MoM), and a basic web dashboard.
2. **Phase 2, Wispr-style dictation bubble:** AccessibilityService, overlay bubble, STT plus cleanup
   LLM, text insertion, personal dictionary, snippets.
3. **Phase 3, Chrome extension:** record Meet/Zoom tabs plus mic into the same backend.
4. **Phase 4, agent integration:** an action-item API and a Google Calendar day planner.

## 7. Decisions needed before planning
1. Hosting: your own PC with Tailscale, or a cloud VM?
2. STT default: Groq free tier (audio is sent to Groq), or fully local (needs a GPU)?
3. Which phase first: meeting recorder (recommended) or dictation bubble?
4. Phone model and Android version (for OEM battery quirks and the minimum SDK).
5. Repo: this profile repo, or a new dedicated repo (recommended, for example `voice-os`)?

## Sources
- Wispr Flow on Android: https://hothardware.com/news/wispr-flow-ai-dictation-app-android , https://wisprflow.ai/android , https://docs.wisprflow.ai/articles/5096240724-navigating-the-wispr-flow-app-desktop-ios-and-android
- Features and pricing: https://www.eesel.ai/blog/wispr-flow-pricing , https://letterly.app/blog/wispr-flow-review/
- Android foreground service changes: https://developer.android.com/develop/background-work/services/fgs/changes , https://developer.android.com/about/versions/12/foreground-services
- Chrome recording extension: https://recall.ai/blog/how-to-build-a-chrome-recording-extension , https://github.com/recallai/chrome-recording-transcription-extension
- Indic ASR: https://caller.digital/blog/open-source-voice-ai-india-sarvam-ai4bharat-bhasini-2026 , https://oriserve.com/blog/oriserve-open-sources-india-focused-ai-speech-model-fine-tuned-on-whisper , https://huggingface.co/shunyalabs/zero-stt-hinglish/blob/main/README.md
- Sarvam pricing: https://www.sarvam.ai/apis/speech-to-text , https://www.callmissed.com/blog/best-speech-text-api-indian-languages-2026
- Groq Whisper limits: https://console.groq.com/docs/model/whisper-large-v3 , https://www.grizzlypeaksoftware.com/articles/p/groq-api-free-tier-limits-in-2026-what-you-actually-get-uwysd6mb
