"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ExecNode } from "@/lib/types";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
  pending: string | null;
  clearPending: () => void;
  nodeById: Record<string, ExecNode>;
  onJump: (id: string) => void;
  onMentions: (ids: string[]) => void;
}

const SUGGESTIONS = [
  "What has Puneet actually shipped that is live today?",
  "How does theZio work under the hood?",
  "Which sponsorships has he closed?",
  "Walk me through his journey from call centre to founder.",
  "What would he build in his first 90 days with us?",
];

const NODE_TOKEN = /\[\[([a-z0-9-]+)\]\]/g;

export default function Jarvis({ open, setOpen, pending, clearPending, nodeById, onJump, onMentions }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"live" | "offline" | null>(null);
  const [voice, setVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const recRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else window.speechSynthesis?.cancel();
  }, [open]);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      setInput(r[0].transcript);
      if (r.isFinal) {
        setVoice(true);
        void askRef.current(r[0].transcript);
      }
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setCanListen(true);
  }, []);

  useEffect(() => {
    if (pending) {
      setOpen(true);
      void ask(pending);
      clearPending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: question }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      setMode(res.headers.get("x-jarvis-mode") === "live" ? "live" : "offline");
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...history, { role: "assistant", content: acc }]);
      }
      if (voiceRef.current) speak(acc);
      const ids = Array.from(acc.matchAll(NODE_TOKEN), (m) => m[1]).filter((id) => nodeById[id]);
      onMentions(Array.from(new Set(ids)));
    } catch {
      setMsgs([...history, { role: "assistant", content: "My uplink dropped. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  const askRef = useRef(ask);
  askRef.current = ask;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const toggleMic = () => {
    if (!recRef.current) return;
    if (listening) recRef.current.stop();
    else {
      window.speechSynthesis?.cancel();
      setInput("");
      recRef.current.start();
      setListening(true);
    }
  };

  const render = (text: string) =>
    text.split("\n").map((line, li) => {
      const parts: React.ReactNode[] = [];
      let last = 0;
      for (const m of line.matchAll(NODE_TOKEN)) {
        const id = m[1];
        const before = line.slice(last, m.index);
        parts.push(before);
        const n = nodeById[id];
        // If the name was just written out, show a compact "open on map" chip instead of repeating it.
        const named = !!n && before.replace(/[*\s(]+$/, "").toLowerCase().endsWith(n.title.toLowerCase().split(" (")[0]);
        parts.push(
          n ? (
            <button
              key={li + "-" + m.index}
              className={"node-chip" + (named ? " mini" : "")}
              onClick={() => onJump(id)}
              title={`Open ${n.title} on the map`}
            >
              {named ? "◎" : `◎ ${n.title}`}
            </button>
          ) : null,
        );
        last = (m.index ?? 0) + m[0].length;
      }
      parts.push(line.slice(last));
      return (
        <Fragment key={li}>
          {li > 0 && <br />}
          {parts.map((p, i) => (typeof p === "string" ? <Bold key={i} text={p} /> : p))}
        </Fragment>
      );
    });

  return (
    <>
      <button className={"jarvis-orb" + (open ? " hidden" : "")} onClick={() => setOpen(true)} aria-label="Open Jarvis">
        <span className="orb-core" />
        <span className="orb-label">ASK JARVIS</span>
      </button>

      <section className={"jarvis" + (open ? " open" : "")} aria-label="Jarvis assistant" aria-hidden={!open}>
        <header className="jv-head">
          <div className="jv-id">
            <span className={"jv-eye" + (busy ? " busy" : "")} />
            <div>
              <b>JARVIS</b>
              <small>
                Puneet&apos;s execution co-pilot{mode === "offline" ? " · offline index" : mode === "live" ? " · Claude live" : ""}
              </small>
            </div>
          </div>
          <div className="jv-actions">
            <button
              className={"icon-btn" + (voice ? " on" : "")}
              onClick={() => {
                window.speechSynthesis?.cancel();
                setVoice(!voice);
              }}
              aria-label={voice ? "Mute Jarvis voice" : "Let Jarvis speak"}
              title={voice ? "Voice on" : "Voice off"}
            >
              {voice ? "🔊" : "🔈"}
            </button>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close Jarvis">
              ✕
            </button>
          </div>
        </header>
        <div className={"jv-wave" + (busy || listening ? " live" : "")} aria-hidden="true">
          {Array.from({ length: 32 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${(i % 8) * 70}ms` }} />
          ))}
        </div>

        <div className="jv-log" ref={scroller}>
          {msgs.length === 0 && (
            <div className="jv-empty">
              <p>
                I know everything on this map: every repo, every brand, every number and where it came from. Ask me anything
                about Puneet.
              </p>
              <div className="jv-sugg">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={"jv-msg " + m.role}>
              {m.role === "assistant" && m.content === "" ? <span className="typing">▍</span> : render(m.content)}
            </div>
          ))}
        </div>

        <form
          className="jv-input"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          {canListen ? (
            <button type="button" className={"mic" + (listening ? " on" : "")} onClick={toggleMic} aria-label="Speak your question">
              ◉
            </button>
          ) : (
            <span className="prompt">›</span>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening…" : "Ask, or tap ◉ and speak…"}
            disabled={busy}
            maxLength={500}
          />
          <button type="submit" disabled={busy || !input.trim()}>
            SEND
          </button>
        </form>
      </section>
    </>
  );
}

function Bold({ text }: { text: string }) {
  const segs = text.split(/\*\*(.+?)\*\*/g);
  return <>{segs.map((s, i) => (i % 2 ? <strong key={i}>{s}</strong> : s))}</>;
}

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<{ isFinal: boolean } & ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

function speak(text: string) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const clean = text.replace(NODE_TOKEN, "").replace(/\*\*/g, "").replace(/[•→]/g, ",");
  const u = new SpeechSynthesisUtterance(clean);
  const v = synth.getVoices().find((x) => /en-GB|Daniel|Google UK English Male/i.test(x.name + x.lang));
  if (v) u.voice = v;
  u.rate = 1.05;
  synth.speak(u);
}
