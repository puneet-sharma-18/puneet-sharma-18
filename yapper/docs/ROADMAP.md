# Roadmap

## Phase 1: meeting recorder (this release)
- [x] Android recorder: 60 s chunks, foreground service, floating button, Quick Settings tile, offline upload queue
- [x] Server: chunk ingest, Groq Whisper transcription, English translation, minutes, retries and rate-limit handling
- [x] Dashboard: conversations, live transcript, English view, minutes, action items, search, audio playback, Markdown export
- [ ] Speaker labels (pyannote on the server, or Sarvam batch diarization as a paid switch)
- [ ] Import an existing audio file from the dashboard

## Phase 2: Wispr-style dictation
- Accessibility service detects the focused text field, and a bubble appears next to it
- Hold or tap to speak, then `/api/dictate` returns cleaned text (no filler words, punctuation, self-corrections), which is inserted
- Personal dictionary (already on the server), snippets ("my calendar link"), styles per app

## Phase 3: Chrome extension
- MV3 extension: `chrome.tabCapture` for the Meet/Zoom tab, mixed with the mic in an offscreen document
- Sends 60 s chunks to the same `/api/recordings` endpoints, so the minutes show up in the same dashboard

## Phase 4: personal agent
- Daily plan built from `/api/action-items` and Google Calendar
- Morning brief: what is due today, from which conversation
