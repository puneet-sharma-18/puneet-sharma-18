"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExecutionMap from "@/components/ExecutionMap";
import CaseFile from "@/components/CaseFile";
import Jarvis from "@/components/Jarvis";
import Boot from "@/components/Boot";
import Timeline from "@/components/Timeline";
import { chapters, clusters, edges, headline, nodes, person } from "@/data/profile";
import type { Cluster, ClusterId, ExecNode } from "@/lib/types";

const MIN_YEAR = Math.min(...nodes.map((n) => n.year));
const MAX_YEAR = Math.max(...nodes.map((n) => n.year));

const CORE_CLUSTER: Cluster = { id: "operator", label: "The Operator", kicker: "", color: "#e9f6ff", angle: 0 };
const CORE_NODE: ExecNode = {
  id: "puneet",
  title: person.name,
  cluster: "operator",
  year: MIN_YEAR,
  status: "live",
  weight: 3,
  tagline: person.oneLiner,
  brief:
    "Two-time founder from Gurugram. Scaled Ekrayah to ₹1 Cr/month across 10+ global marketplaces, built The Paan Legacy into a Top-5 brand on Zomato & Swiggy, leads community and partnerships at D2C Insider, and in 2026 shipped 28 software projects — theZio, the Frontier summit platform, the AI Bootcamp and more. Every node on this map is something that exists outside a slide deck.",
  executed: [
    "Founded and scaled Ekrayah to ₹1 Cr/month.",
    "Founded The Paan Legacy — Top 5 on Zomato & Swiggy in 7 months.",
    "Closed Airpay (Title) and GoKwik (Supporting) for D2C Insider.",
    "Built Frontier's full platform solo — 1st edition sold out.",
    "Founded and shipped theZio, live at thezio.co.",
    "Trained 100+ founders to build AI teams in the D2C AI Bootcamp.",
  ],
  metrics: headline.map((h) => ({ value: h.value, label: h.label })),
  insight:
    "The pattern: live inside a problem as an operator, then build the system that removes it. Marketplaces → automation. Paan brand → commerce + finance software. Community → events platform + AI concierge.",
  proof: [
    { label: "GitHub: puneet-sharma-18", url: person.github },
    { label: person.email, url: `mailto:${person.email}` },
  ],
};

export default function Page() {
  const [booted, setBooted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusCluster, setFocusCluster] = useState<ClusterId | null>(null);
  const [year, setYear] = useState(MAX_YEAR);
  const [playing, setPlaying] = useState(false);
  const [jarvisOpen, setJarvisOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [view, setView] = useState<"map" | "list">("map");
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), []);
  const clusterById = useMemo(() => Object.fromEntries(clusters.map((c) => [c.id, c])), []) as Record<ClusterId, Cluster>;

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setFocusCluster(null);
    setYear(MAX_YEAR);
  }, []);

  // Narrow screens default to the list view.
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setView("list");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setJarvisOpen(true);
      } else if (e.key === "Escape") {
        if (jarvisOpen) setJarvisOpen(false);
        else {
          setSelectedId(null);
          setFocusCluster(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jarvisOpen]);

  const stopPlay = () => {
    if (playTimer.current) clearInterval(playTimer.current);
    playTimer.current = null;
    setPlaying(false);
  };

  const togglePlay = () => {
    if (playing) return stopPlay();
    setSelectedId(null);
    setFocusCluster(null);
    setPlaying(true);
    let y = MIN_YEAR;
    setYear(y);
    playTimer.current = setInterval(() => {
      y += 1;
      setYear(y);
      if (y >= MAX_YEAR) stopPlay();
    }, 1100);
  };

  useEffect(() => () => stopPlay(), []);

  const selected = selectedId === "puneet" ? CORE_NODE : selectedId ? nodeById[selectedId] : null;
  const selectedCluster = selectedId === "puneet" ? CORE_CLUSTER : selected ? clusterById[selected.cluster] : null;
  const liveCount = nodes.filter((n) => n.status === "live").length;

  return (
    <main className={"app" + (booted ? " booted" : "")}>
      {!booted && <Boot onDone={() => setBooted(true)} />}

      <header className="topbar">
        <div className="brand" onClick={() => select("puneet")} role="button" tabIndex={0}>
          <span className="brand-dot" />
          <div>
            <b>{person.name.toUpperCase()}</b>
            <small>{person.title}</small>
          </div>
        </div>
        <div className="stats">
          {headline.map((h) => (
            <div key={h.label} className="stat">
              <b>{h.value}</b>
              <span>{h.label}</span>
            </div>
          ))}
          <div className="stat live">
            <b>{liveCount}</b>
            <span>live right now</span>
          </div>
        </div>
        <div className="view-toggle" role="tablist">
          <button className={view === "map" ? "on" : ""} onClick={() => setView("map")}>
            MAP
          </button>
          <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
            LIST
          </button>
        </div>
      </header>

      {view === "map" ? (
        <section className="stage">
          <div className="hero-copy">
            <h1>
              Don&apos;t take my word for it.
              <br />
              <span>Click anything.</span>
            </h1>
            <p>
              {nodes.length} things I&apos;ve executed — brands, deals, events and AI systems. Each node opens a case file: what
              it is, what I did, how it works, the numbers and the receipts. Lines show how one build led to the next.
            </p>
          </div>

          <ExecutionMap
            nodes={nodes}
            clusters={clusters}
            edges={edges}
            selectedId={selectedId === "puneet" ? null : selectedId}
            highlightIds={highlightIds}
            year={year}
            focusCluster={focusCluster}
            onSelect={select}
            onClusterClick={(id) => {
              setSelectedId(null);
              setFocusCluster((c) => (c === id ? null : id));
            }}
          />

          <div className="legend">
            {clusters.map((c) => (
              <button
                key={c.id}
                className={focusCluster === c.id ? "on" : ""}
                style={{ ["--c" as string]: c.color }}
                onClick={() => {
                  setSelectedId(null);
                  setFocusCluster((f) => (f === c.id ? null : c.id));
                }}
              >
                <i />
                <span>
                  <b>{c.label}</b>
                  <small>{c.kicker}</small>
                </span>
              </button>
            ))}
            <div className="legend-hint">drag to pan · scroll to zoom · press / for Jarvis</div>
          </div>

          <Timeline
            min={MIN_YEAR}
            max={MAX_YEAR}
            year={year}
            setYear={(y) => {
              stopPlay();
              setYear(y);
            }}
            playing={playing}
            onPlay={togglePlay}
            chapters={chapters}
          />
        </section>
      ) : (
        <ListView onSelect={select} />
      )}

      {selected && selectedCluster && (
        <CaseFile
          node={selected}
          cluster={selectedCluster}
          edges={edges}
          nodeById={nodeById}
          onClose={() => setSelectedId(null)}
          onJump={select}
          onAsk={(q) => setPending(q)}
        />
      )}

      <Jarvis
        open={jarvisOpen}
        setOpen={setJarvisOpen}
        pending={pending}
        clearPending={() => setPending(null)}
        nodeById={nodeById}
        onJump={(id) => {
          select(id);
          if (window.matchMedia("(max-width: 760px)").matches) setJarvisOpen(false);
        }}
        onMentions={(ids) => {
          setHighlightIds(ids);
          setTimeout(() => setHighlightIds([]), 9000);
        }}
      />
    </main>
  );
}

function ListView({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <section className="listview">
      <div className="hero-copy static">
        <h1>
          Don&apos;t take my word for it. <span>Open anything.</span>
        </h1>
      </div>
      {clusters.map((c) => (
        <div key={c.id} className="lv-cluster" style={{ ["--accent" as string]: c.color }}>
          <h2>
            {c.label} <small>{c.kicker}</small>
          </h2>
          <div className="lv-grid">
            {nodes
              .filter((n) => n.cluster === c.id)
              .sort((a, b) => b.weight - a.weight || b.year - a.year)
              .map((n) => (
                <button key={n.id} className="lv-card" onClick={() => onSelect(n.id)}>
                  <div className="lv-top">
                    <span className={"badge st-" + n.status}>● {n.status.toUpperCase()}</span>
                    <span className="lv-year">{n.year}</span>
                  </div>
                  <b>{n.title}</b>
                  <p>{n.tagline}</p>
                  {n.metrics?.[0] && (
                    <div className="lv-metric">
                      <b>{n.metrics[0].value}</b> {n.metrics[0].label}
                    </div>
                  )}
                </button>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
