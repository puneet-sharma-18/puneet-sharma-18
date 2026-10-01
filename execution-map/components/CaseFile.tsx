"use client";

import { useEffect, useState } from "react";
import type { Cluster, Edge, ExecNode } from "@/lib/types";

interface Props {
  node: ExecNode;
  cluster: Cluster;
  edges: Edge[];
  nodeById: Record<string, ExecNode>;
  onClose: () => void;
  onJump: (id: string) => void;
  onAsk: (q: string) => void;
}

type Tab = "brief" | "executed" | "how" | "numbers";

const STATUS_LABEL: Record<ExecNode["status"], string> = {
  live: "LIVE",
  shipped: "SHIPPED",
  building: "BUILDING",
  experiment: "EXPERIMENT",
  archived: "ARCHIVED",
};

export default function CaseFile({ node, cluster, edges, nodeById, onClose, onJump, onAsk }: Props) {
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "brief", label: "Brief", show: true },
    { id: "executed", label: "What I executed", show: node.executed.length > 0 },
    { id: "how", label: "How it works", show: !!(node.how?.length || node.stack?.length) },
    { id: "numbers", label: "Numbers", show: !!node.metrics?.length },
  ];
  const [tab, setTab] = useState<Tab>("brief");
  useEffect(() => setTab("brief"), [node.id]);

  const led = edges.filter((e) => e.from === node.id);
  const came = edges.filter((e) => e.to === node.id);

  return (
    <aside className="casefile" style={{ ["--accent" as string]: cluster.color }} aria-label={`${node.title} case file`}>
      <header>
        <div className="cf-kicker">
          <span>CASE FILE · {cluster.label.toUpperCase()}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close case file">
            ✕
          </button>
        </div>
        <h2>{node.title}</h2>
        <p className="cf-tagline">{node.tagline}</p>
        <div className="cf-badges">
          <span className={"badge st-" + node.status}>● {STATUS_LABEL[node.status]}</span>
          <span className="badge">SINCE {node.year}</span>
        </div>
      </header>

      <nav className="cf-tabs" role="tablist">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
      </nav>

      <div className="cf-body">
        {tab === "brief" && (
          <>
            <p className="cf-lead">{node.brief}</p>
            {node.insight && (
              <div className="insight">
                <div className="insight-k">HOW I FIGURED IT OUT</div>
                <p>{node.insight}</p>
              </div>
            )}
            {node.metrics && node.metrics.length > 0 && (
              <div className="metric-row">
                {node.metrics.slice(0, 3).map((m) => (
                  <div key={m.label} className="metric" title={m.source}>
                    <b>{m.value}</b>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "executed" && (
          <ol className="executed">
            {node.executed.map((x, i) => (
              <li key={i}>
                <span className="ex-n">{String(i + 1).padStart(2, "0")}</span>
                <span>{x}</span>
              </li>
            ))}
          </ol>
        )}

        {tab === "how" && (
          <>
            {node.how && (
              <div className="flow">
                {node.how.map((s, i) => (
                  <div key={i} className="flow-step" style={{ animationDelay: `${i * 90}ms` }}>
                    <span className="flow-dot" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
            {node.stack && (
              <div className="stack">
                {node.stack.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "numbers" && node.metrics && (
          <div className="metric-grid">
            {node.metrics.map((m) => (
              <div key={m.label} className="metric">
                <b>{m.value}</b>
                <span>{m.label}</span>
                {m.source && <em>src: {m.source}</em>}
              </div>
            ))}
          </div>
        )}

        {(led.length > 0 || came.length > 0) && (
          <div className="dna-list">
            <div className="insight-k">EXECUTION DNA</div>
            {came.map((e) => (
              <button key={"c" + e.from} className="dna-item" onClick={() => onJump(e.from)}>
                <span className="dna-dir">← from</span> <b>{nodeById[e.from]?.title}</b>
                <span className="dna-why">{e.label}</span>
              </button>
            ))}
            {led.map((e) => (
              <button key={"l" + e.to} className="dna-item" onClick={() => onJump(e.to)}>
                <span className="dna-dir">led to →</span> <b>{nodeById[e.to]?.title}</b>
                <span className="dna-why">{e.label}</span>
              </button>
            ))}
          </div>
        )}

        {node.proof && node.proof.length > 0 && (
          <div className="proof">
            <div className="insight-k">RECEIPTS</div>
            {node.proof.map((p) =>
              p.url ? (
                <a key={p.label} href={p.url} target="_blank" rel="noreferrer" className="proof-item">
                  ↗ {p.label}
                </a>
              ) : (
                <span key={p.label} className="proof-item muted">
                  ◆ {p.label}
                </span>
              ),
            )}
          </div>
        )}
      </div>

      <footer className="cf-foot">
        <button className="ask-btn" onClick={() => onAsk(`Tell me more about ${node.title}. What was hardest to execute?`)}>
          ◉ Ask Jarvis about {node.title}
        </button>
      </footer>
    </aside>
  );
}
