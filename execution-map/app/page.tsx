"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Universe from "@/components/Universe";
import CaseFile from "@/components/CaseFile";
import Jarvis from "@/components/Jarvis";
import BigBang from "@/components/BigBang";
import Timeline from "@/components/Timeline";
import Starfield from "@/components/Starfield";
import Scramble from "@/components/Scramble";
import CommandPalette, { type Action } from "@/components/CommandPalette";
import Terminal from "@/components/Terminal";
import SystemsPanel, { useSystems } from "@/components/SystemsPanel";
import shiplog from "@/data/shiplog.json";
import { chapters, clusters, edges, headline, nodes, person } from "@/data/profile";
import type { Cluster, ClusterId, ExecNode } from "@/lib/types";

const MIN_YEAR = Math.min(...nodes.map((n) => n.year));
const MAX_YEAR = Math.max(...nodes.map((n) => n.year));

const CORE_CLUSTER: Cluster = { id: "operator", label: "The Sun", kicker: "", color: "#f0c27a", orbit: 0, size: 0, phase: 0, body: "rocky" };
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
  const [cmdk, setCmdk] = useState(false);
  const [term, setTerm] = useState(false);
  const [ops, setOps] = useState(false);
  const systems = useSystems();
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), []);
  const clusterById = useMemo(() => Object.fromEntries(clusters.map((c) => [c.id, c])), []) as Record<ClusterId, Cluster>;

  // Selecting a project flies to its planet, then opens the case file.
  const select = useCallback((id: string) => {
    setSelectedId(id);
    setFocusCluster(id === "puneet" ? null : (nodes.find((n) => n.id === id)?.cluster ?? null));
    setYear(MAX_YEAR);
  }, []);

  // The Big Bang plays once per browser session.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("bang")) setBooted(true);
    } catch {
      /* storage unavailable — just play it */
    }
  }, []);

  // Narrow screens default to the list view.
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setView("list");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdk((v) => !v);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setJarvisOpen(true);
      } else if (e.key === "`" && !typing) {
        e.preventDefault();
        setTerm(true);
      } else if (e.key === "Escape") {
        if (cmdk) setCmdk(false);
        else if (term) setTerm(false);
        else if (ops) setOps(false);
        else if (jarvisOpen) setJarvisOpen(false);
        else if (selectedId) setSelectedId(null);
        else setFocusCluster(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jarvisOpen, cmdk, term, ops, selectedId]);

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
  const up = systems?.filter((r) => r.state === "up").length ?? 0;

  const actions: Action[] = [
    { id: "a-jarvis", label: "Ask Jarvis", hint: "AI that knows every project · /", run: () => setJarvisOpen(true) },
    { id: "a-play", label: "Play the journey", hint: "2016 → 2026, chapter by chapter", run: () => togglePlay() },
    { id: "a-ops", label: "Open ops console", hint: "Live systems + ship log", run: () => setOps(true) },
    { id: "a-term", label: "Open terminal", hint: "For the engineers in the room · `", run: () => setTerm(true) },
    { id: "a-list", label: view === "map" ? "Switch to list view" : "Switch to map view", hint: "Same data, different lens", run: () => setView(view === "map" ? "list" : "map") },
    { id: "a-mail", label: "Copy email", hint: person.email, run: () => navigator.clipboard?.writeText(person.email) },
    { id: "a-me", label: "Who is Puneet?", hint: "Open the core case file", run: () => select("puneet") },
  ];

  return (
    <main className={"app" + (booted ? " booted" : "")}>
      {!booted && (
        <BigBang
          onDone={() => {
            setBooted(true);
            try {
              sessionStorage.setItem("bang", "1");
            } catch {
              /* ignore */
            }
          }}
        />
      )}
      <Starfield />
      <div className="aurora" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

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
        <button className="pill sys-pill" onClick={() => setOps(true)} title="Live production systems + ship log">
          <span className={"led " + (systems ? (up > 0 ? "up" : "unreachable") : "")} />
          {systems ? (up > 0 ? `${up}/${systems.length} systems live` : "ops console") : "pinging…"}
          <span className="pill-sub">{shiplog.total.toLocaleString("en-IN")} commits</span>
        </button>
        <button className="pill" onClick={() => setCmdk(true)} aria-label="Open command palette">
          <kbd>⌘K</kbd>
        </button>
        <button className="pill" onClick={() => setTerm(true)} aria-label="Open terminal" title="Terminal">
          <span className="mono">&gt;_</span>
        </button>
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
        <section className={"stage" + (focusCluster ? " focused" : "")}>
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="led up" /> A SYSTEM OF {nodes.length} THINGS, ALL IN ORBIT
            </div>
            <h1>
              <em>Every universe starts</em>
              <br />
              <em>with a single point.</em>
              <span className="grad">
                <Scramble text="Explore mine." speed={40} />
              </span>
            </h1>
            <p>
              The Sun is the work. Planets are the areas of work, from the operator years to AI. Every moon is something that
              shipped. Click a planet to fly in, then click a moon to open its case file.
            </p>
          </div>

          <Universe
            nodes={nodes}
            clusters={clusters}
            edges={edges}
            selectedId={selectedId === "puneet" ? null : selectedId}
            highlightIds={highlightIds}
            year={year}
            focusCluster={focusCluster}
            panelOpen={!!selectedId}
            onSelect={select}
            onFocus={(id) => {
              setSelectedId(null);
              setFocusCluster(id);
            }}
          />

          <div className="legend">
            <div className="legend-k">SYSTEM INDEX</div>
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
                  <small>
                    {nodes.filter((n) => n.cluster === c.id).length} moons · {c.kicker}
                  </small>
                </span>
              </button>
            ))}
            <div className="legend-hint">
              <kbd>drag</kbd> pan · <kbd>scroll</kbd> zoom · <kbd>⌘K</kbd> search · <kbd>/</kbd> jarvis · <kbd>`</kbd> terminal
            </div>
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

      <CommandPalette open={cmdk} onClose={() => setCmdk(false)} actions={actions} onOpenNode={select} />
      <Terminal open={term} onClose={() => setTerm(false)} onOpenNode={select} onAsk={(q) => setPending(q)} onPlay={togglePlay} />
      <SystemsPanel
        results={systems}
        open={ops}
        onClose={() => setOps(false)}
        onJump={(id) => {
          setOps(false);
          select(id);
        }}
      />

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
        <div className="eyebrow">
          <span className="led up" /> A SYSTEM OF {nodes.length} THINGS, ALL IN ORBIT
        </div>
        <h1>
          <em>Every universe starts with a single point.</em>
          <span className="grad">Explore mine.</span>
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
