"use client";

import { useEffect, useRef, useState } from "react";
import { clusters, headline, nodes, person } from "@/data/profile";
import shiplog from "@/data/shiplog.json";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenNode: (id: string) => void;
  onAsk: (q: string) => void;
  onPlay: () => void;
}

type Line = { kind: "in" | "out" | "err" | "accent"; text: string };

const BANNER: Line[] = [
  { kind: "accent", text: "puneet-os v2026.10 — type `help` to list commands, `neofetch` for the short version." },
];

const allStack = Array.from(new Set(nodes.flatMap((n) => n.stack ?? [])));

function run(raw: string, props: Props): Line[] | "clear" {
  const [cmd, ...rest] = raw.trim().split(/\s+/);
  const arg = rest.join(" ");
  const out = (text: string): Line => ({ kind: "out", text });
  switch ((cmd ?? "").toLowerCase()) {
    case "":
      return [];
    case "help":
      return [
        "whoami            who is this guy",
        "neofetch          the one-screen summary",
        "ls [cluster]      list everything executed (clusters: " + clusters.map((c) => c.id).join(", ") + ")",
        "cat <id>          read a case file in the terminal",
        "open <id>         fly the map to a node",
        "stack             every technology used in production",
        "git log           shipping velocity",
        "jarvis <question> ask the AI",
        "play              replay the journey",
        "contact           how to reach Puneet",
        "clear / exit",
      ].map(out);
    case "whoami":
      return [out(`${person.name} — ${person.title}`), out(person.oneLiner)];
    case "neofetch":
      return [
        { kind: "accent", text: "   ▄▄▄▄▄▄▄    puneet@execution-map" },
        out("  █ ◉   ◉ █   ───────────────────"),
        out("  █   ▀   █   role:    " + person.title),
        out("  █ ╲___╱ █   based:   " + person.location),
        out("   ▀▀▀▀▀▀▀    " + headline.map((h) => `${h.value} ${h.label}`).join(" · ")),
        out(`              commits: ${shiplog.total} in ${shiplog.activeDays} days`),
        out(`              nodes:   ${nodes.length} executed · ${nodes.filter((n) => n.status === "live").length} live`),
        out(`              stack:   ${allStack.length} technologies in production`),
      ];
    case "ls": {
      const list = nodes.filter((n) => !arg || n.cluster === arg);
      if (!list.length) return [{ kind: "err", text: `ls: no cluster '${arg}'` }];
      return list.map((n) => out(`${n.status.padEnd(10)} ${String(n.year).padEnd(5)} ${n.id.padEnd(22)} ${n.tagline}`));
    }
    case "cat": {
      const n = nodes.find((x) => x.id === arg);
      if (!n) return [{ kind: "err", text: `cat: ${arg || "<id>"}: no such node. try \`ls\`` }];
      return [
        { kind: "accent", text: `# ${n.title}  [${n.status}] since ${n.year}` },
        out(n.brief),
        ...n.executed.map((x) => out("  ✓ " + x)),
        ...(n.how ? [out("  pipeline: " + n.how.join(" → "))] : []),
        ...(n.metrics ? [out("  numbers: " + n.metrics.map((m) => `${m.value} ${m.label}`).join(" · "))] : []),
      ];
    }
    case "open": {
      const n = nodes.find((x) => x.id === arg);
      if (!n) return [{ kind: "err", text: `open: ${arg || "<id>"}: no such node` }];
      props.onOpenNode(n.id);
      props.onClose();
      return [];
    }
    case "stack":
      return [out(allStack.join(" · "))];
    case "git":
      if (arg !== "log") return [{ kind: "err", text: "git: only `git log` is wired up here" }];
      return [
        { kind: "accent", text: `${shiplog.total} commits · ${shiplog.activeDays} active days · Apr → Sep 2026` },
        ...Object.entries(shiplog.repos as Record<string, number>)
          .slice(0, 10)
          .map(([r, n]) => out(`${String(n).padStart(5)}  ${"█".repeat(Math.max(1, Math.round(n / 25)))} ${r}`)),
      ];
    case "jarvis":
      if (!arg) return [{ kind: "err", text: "usage: jarvis <question>" }];
      props.onAsk(arg);
      props.onClose();
      return [];
    case "play":
      props.onPlay();
      props.onClose();
      return [];
    case "contact":
      return [out(person.email), out(person.phone), out(person.github)];
    case "sudo":
      if (/hire/i.test(arg))
        return [
          { kind: "accent", text: "[sudo] permission granted." },
          out(`Next step: ${person.email} · ${person.phone}. He replies fast.`),
        ];
      return [{ kind: "err", text: "puneet is not in the sudoers file. This incident will be reported." }];
    case "clear":
      return "clear";
    case "exit":
      props.onClose();
      return [];
    default:
      return [{ kind: "err", text: `command not found: ${cmd}. try \`help\`` }];
  }
}

export default function Terminal(props: Props) {
  const { open, onClose } = props;
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const ref = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 30);
  }, [open]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines]);

  if (!open) return null;

  const submit = () => {
    const res = run(input, props);
    setHistory((h) => [input, ...h]);
    setHi(-1);
    if (res === "clear") setLines([]);
    else setLines((l) => [...l, { kind: "in", text: input }, ...res]);
    setInput("");
  };

  const complete = () => {
    const [cmd, part = ""] = input.split(/\s+/);
    if (!["cat", "open"].includes(cmd)) return;
    const hit = nodes.map((n) => n.id).filter((id) => id.startsWith(part));
    if (hit.length === 1) setInput(`${cmd} ${hit[0]}`);
    else if (hit.length > 1) setLines((l) => [...l, { kind: "out", text: hit.join("  ") }]);
  };

  return (
    <div className="term-wrap" onClick={onClose}>
      <div className="term" onClick={(e) => (e.stopPropagation(), ref.current?.focus())}>
        <div className="term-bar">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          <span>puneet@execution-map: ~</span>
          <span className="muted">esc to close</span>
        </div>
        <div className="term-log" ref={log}>
          {lines.map((l, i) => (
            <div key={i} className={"tl " + l.kind}>
              {l.kind === "in" ? (
                <>
                  <span className="ps1">~/puneet $</span> {l.text}
                </>
              ) : (
                l.text
              )}
            </div>
          ))}
          <div className="tl in">
            <span className="ps1">~/puneet $</span>
            <input
              ref={ref}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              aria-label="Terminal input"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                else if (e.key === "Tab") {
                  e.preventDefault();
                  complete();
                } else if (e.key === "ArrowUp" && history[hi + 1] !== undefined) {
                  setHi(hi + 1);
                  setInput(history[hi + 1]);
                } else if (e.key === "ArrowDown") {
                  const n = hi - 1;
                  setHi(Math.max(-1, n));
                  setInput(n >= 0 ? history[n] : "");
                } else if (e.key === "Escape") onClose();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
