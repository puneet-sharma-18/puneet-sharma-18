"use client";

import { useEffect, useMemo, useState } from "react";
import shiplog from "@/data/shiplog.json";

interface Result {
  name: string;
  url: string;
  node: string;
  state: "up" | "degraded" | "unreachable";
  ms: number;
  code: number;
}

interface Props {
  results: Result[] | null;
  open: boolean;
  onClose: () => void;
  onJump: (id: string) => void;
}

const DAY = 86400000;
const days = shiplog.days as Record<string, number>;

// Sequential single-hue ramp (dim → bright cyan) for commit intensity.
const RAMP = ["rgba(240,194,122,0.07)", "rgba(240,194,122,0.28)", "rgba(240,194,122,0.5)", "rgba(240,194,122,0.75)", "#f0c27a"];
const bucket = (n: number) => (n === 0 ? 0 : n < 4 ? 1 : n < 10 ? 2 : n < 25 ? 3 : 4);
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function useSystems() {
  const [results, setResults] = useState<Result[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => alive && setResults(j.results))
      .catch(() => alive && setResults([]));
    return () => {
      alive = false;
    };
  }, []);
  return results;
}

export default function SystemsPanel({ results, open, onClose, onJump }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const start = new Date("2026-04-13T00:00:00Z"); // Monday before first commit
    const end = new Date("2026-09-30T00:00:00Z");
    const cols: { date: string; n: number }[][] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
      const d = new Date(t);
      const dow = (d.getUTCDay() + 6) % 7;
      if (dow === 0) cols.push([]);
      const key = d.toISOString().slice(0, 10);
      cols[cols.length - 1].push({ date: key, n: days[key] ?? 0 });
    }
    return cols;
  }, []);

  const repos = Object.entries(shiplog.repos as Record<string, number>).slice(0, 8);
  const maxRepo = repos[0]?.[1] ?? 1;
  const peak = Math.max(...Object.values(days));
  const reachable = results?.filter((r) => r.state !== "unreachable") ?? [];
  const allUnreachable = results && results.length > 0 && reachable.length === 0;

  return (
    <section className={"sys" + (open ? " open" : "")} aria-hidden={!open} aria-label="Systems and ship log">
      <header className="sys-head">
        <div>
          <span className="eyebrow">OPS CONSOLE</span>
          <h3>
            Things that are <em>running</em>, and how fast they shipped.
          </h3>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="sys-grid">
        <div className="sys-card">
          <div className="sys-k">
            PRODUCTION SYSTEMS{" "}
            <span className="muted">
              {results ? (allUnreachable ? "· can't reach from this network" : `· ${reachable.length}/${results.length} responding`) : "· pinging…"}
            </span>
          </div>
          <ul className="sys-list">
            {(results ?? []).map((r) => (
              <li key={r.url}>
                <button onClick={() => onJump(r.node)}>
                  <span className={"led " + r.state} />
                  <b>{r.name}</b>
                  <span className="host">{r.url.replace("https://", "")}</span>
                  <span className="lat">{r.state === "unreachable" ? "—" : `${r.ms}ms`}</span>
                </button>
              </li>
            ))}
            {!results && Array.from({ length: 6 }, (_, i) => <li key={i} className="skeleton" />)}
          </ul>
        </div>

        <div className="sys-card">
          <div className="sys-k">
            SHIP LOG · 2026 <span className="muted">· every commit across {Object.keys(shiplog.repos).length} repos</span>
          </div>
          <div className="ship-stats">
            <div>
              <b>{shiplog.total.toLocaleString("en-IN")}</b>
              <span>commits</span>
            </div>
            <div>
              <b>{shiplog.activeDays}</b>
              <span>days shipped</span>
            </div>
            <div>
              <b>{peak}</b>
              <span>commits, best day</span>
            </div>
          </div>
          <div className="heat" onMouseLeave={() => setHover(null)}>
            {weeks.map((w, i) => (
              <div key={i} className="heat-col">
                {w.map((c) => (
                  <span
                    key={c.date}
                    className="cell"
                    style={{ background: RAMP[bucket(c.n)] }}
                    onMouseEnter={() => setHover(`${fmt(new Date(c.date))} — ${c.n} commit${c.n === 1 ? "" : "s"}`)}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="heat-foot">
            <span className="readout">{hover ?? "Hover a day"}</span>
            <span className="scale">
              less {RAMP.map((c) => <i key={c} style={{ background: c }} />)} more
            </span>
          </div>
        </div>

        <div className="sys-card wide">
          <div className="sys-k">WHERE THE COMMITS WENT</div>
          <div className="bars">
            {repos.map(([name, n]) => (
              <div key={name} className="bar-row" title={`${name}: ${n} commits`}>
                <span className="bar-name">{name}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(n / maxRepo) * 100}%` }} />
                </span>
                <span className="bar-n">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
