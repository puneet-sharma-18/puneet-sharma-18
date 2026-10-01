"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Cluster, ClusterId, Edge, ExecNode } from "@/lib/types";

interface Props {
  nodes: ExecNode[];
  clusters: Cluster[];
  edges: Edge[];
  selectedId: string | null;
  highlightIds: string[];
  year: number;
  focusCluster: ClusterId | null;
  panelOpen: boolean;
  onSelect: (id: string) => void;
  onFocus: (id: ClusterId | null) => void;
}

interface Cam {
  x: number;
  y: number;
  k: number;
}
interface Pt {
  x: number;
  y: number;
}

const BASE_W = 1500;
const BASE_H = 950;
const TILT = 0.36; // orbital plane seen at an angle — the "Google Earth" tilt
// Nudged right so the hero copy and index on the left never cover a planet.
const SYSTEM: Cam = { x: -100, y: 20, k: 1.04 };
const FOCUS_K = 3.4;
const rad = (d: number) => (d * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Kepler-ish angular speed: outer planets move slower. */
const omega = (orbit: number) => 0.03 * Math.pow(190 / orbit, 1.5);

export default function Universe(props: Props) {
  const { nodes, clusters, edges, selectedId, highlightIds, year, focusCluster, panelOpen, onSelect, onFocus } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [, setFrame] = useState(0);
  const cam = useRef<Cam>({ ...SYSTEM, k: 0.55 });
  const camFrom = useRef<Cam>(cam.current);
  const camTo = useRef<Cam>(SYSTEM);
  const camT = useRef(0);
  const clock = useRef(0);
  const expand = useRef(0);
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const [scalePx, setScalePx] = useState(1);

  const moonsOf = useMemo(() => {
    const m: Record<string, ExecNode[]> = {};
    for (const c of clusters) m[c.id] = nodes.filter((n) => n.cluster === c.id).sort((a, b) => a.year - b.year || b.weight - a.weight);
    return m;
  }, [nodes, clusters]);
  const clusterOf = useMemo(() => Object.fromEntries(clusters.map((c) => [c.id, c])), [clusters]) as Record<ClusterId, Cluster>;
  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  // ── world geometry for the current clock ──
  const planetPos = (c: Cluster): Pt & { depth: number; angle: number } => {
    const a = rad(c.phase) + clock.current * omega(c.orbit);
    return { x: Math.cos(a) * c.orbit, y: Math.sin(a) * c.orbit * TILT, depth: Math.sin(a), angle: a };
  };
  const moonPos = (n: ExecNode, p: Pt): Pt => {
    const c = clusterOf[n.cluster];
    const list = moonsOf[n.cluster];
    const i = list.indexOf(n);
    const count = list.length;
    // Compact orbit (system view)
    const a0 = (i / count) * Math.PI * 2 + clock.current * 0.22;
    const r0 = c.size + 8 + (i % 2) * 6;
    const sys = { x: p.x + Math.cos(a0) * r0, y: p.y + Math.sin(a0) * r0 * 0.5 };
    if (focusCluster !== n.cluster && expand.current === 0) return sys;
    // Expanded constellation (planet view)
    const e = focusCluster === n.cluster ? expand.current : 0;
    const a1 = -Math.PI / 2 + (i / count) * Math.PI * 2;
    const r1 = c.size + (i % 2 ? 62 : 40);
    const ex = { x: p.x + Math.cos(a1) * r1 * 1.25, y: p.y + Math.sin(a1) * r1 * 0.78 };
    return { x: lerp(sys.x, ex.x, ease(e)), y: lerp(sys.y, ex.y, ease(e)) };
  };

  // ── animation loop: orbits, camera tween, moon expansion ──
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let dirty = false;
      if (!focusCluster && !reduce && !drag.current?.moved) {
        clock.current += dt;
        dirty = true;
      }
      const targetE = focusCluster ? 1 : 0;
      if (expand.current !== targetE) {
        expand.current = targetE > expand.current ? Math.min(1, expand.current + dt * 1.6) : Math.max(0, expand.current - dt * 2.2);
        dirty = true;
      }
      if (camT.current < 1) {
        camT.current = Math.min(1, camT.current + dt / 1.1);
        const e = ease(camT.current);
        const f = camFrom.current;
        const t = camTo.current;
        // Zoom out a little mid-flight, like Google Earth's arc between places.
        const hop = Math.sin(Math.PI * e) * (Math.abs(f.k - t.k) > 0.5 ? 0.18 : 0);
        cam.current = { x: lerp(f.x, t.x, e), y: lerp(f.y, t.y, e), k: lerp(f.k, t.k, e) * (1 - hop) };
        dirty = true;
      }
      if (dirty) setFrame((n) => (n + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCluster]);

  const flyTo = (t: Cam) => {
    camFrom.current = { ...cam.current };
    camTo.current = t;
    camT.current = 0;
  };

  useEffect(() => {
    if (focusCluster) {
      const p = planetPos(clusterOf[focusCluster]);
      flyTo({ x: p.x + (panelOpen ? 62 : 0), y: p.y + 4, k: FOCUS_K });
    } else flyTo(SYSTEM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCluster, panelOpen]);

  // Screen pixels per world unit at k=1 (for HUD scale bar + dragging).
  useEffect(() => {
    const measure = () => {
      const r = svgRef.current?.getBoundingClientRect();
      if (r) setScalePx(Math.min(r.width / BASE_W, r.height / BASE_H));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = cam.current;
      const k = Math.min(6, Math.max(0.5, c.k * (e.deltaY > 0 ? 0.9 : 1.1)));
      cam.current = { ...c, k };
      camT.current = 1;
      setFrame((n) => n + 1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f: number) => flyTo({ ...cam.current, k: Math.min(6, Math.max(0.5, cam.current.k * f)) });

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) {
      const s = scalePx * cam.current.k;
      cam.current = { ...cam.current, x: d.cx - dx / s, y: d.cy - dy / s };
      camT.current = 1;
      setFrame((n) => n + 1);
    }
  };
  const endDrag = () => setTimeout(() => (drag.current = null), 0);
  const click = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!drag.current?.moved) fn();
  };

  // ── render ──
  const c = cam.current;
  const vw = BASE_W / c.k;
  const vh = BASE_H / c.k;
  const fs = (px: number) => px / c.k; // constant on-screen font size
  const born = (n: ExecNode) => n.year <= year;
  const hl = new Set(highlightIds);
  const activeMoon = hover && nodeById[hover] ? hover : selectedId;

  const planets = clusters.map((cl) => ({ cl, p: planetPos(cl) }));
  const behind = planets.filter((x) => x.p.depth < 0).sort((a, b) => a.p.depth - b.p.depth);
  const front = planets.filter((x) => x.p.depth >= 0).sort((a, b) => a.p.depth - b.p.depth);
  const posById: Record<string, Pt> = {};
  for (const { cl, p } of planets) for (const n of moonsOf[cl.id]) posById[n.id] = moonPos(n, p);

  const sunLight = (p: Pt) => {
    const d = Math.hypot(p.x, p.y) || 1;
    return { fx: 0.5 - (p.x / d) * 0.32, fy: 0.5 - (p.y / d) * 0.32 };
  };

  const renderPlanet = ({ cl, p }: (typeof planets)[number]) => {
    const moons = moonsOf[cl.id];
    const alive = moons.filter(born);
    if (alive.length === 0) return null;
    const focused = focusCluster === cl.id;
    const dimmed = focusCluster && !focused;
    const r = cl.size * (1 + p.depth * 0.12);
    const { fx, fy } = sunLight(p);
    const isHover = hover === cl.id;
    const anyHl = alive.some((n) => hl.has(n.id));
    return (
      <g key={cl.id} className={"body" + (dimmed ? " dim" : "")}>
        <radialGradient id={`pg-${cl.id}`} cx={fx} cy={fy} r="0.75" fx={fx} fy={fy}>
          <stop offset="0%" stopColor="#fff6e6" stopOpacity="0.95" />
          <stop offset="22%" stopColor={cl.color} />
          <stop offset="100%" stopColor="#120f0b" />
        </radialGradient>
        {anyHl && !focused && <circle cx={p.x} cy={p.y} r={r + 10} className="beacon" stroke={cl.color} strokeWidth={fs(1.5)} />}
        {cl.body === "ringed" && (
          <ellipse cx={p.x} cy={p.y} rx={r * 2.1} ry={r * 0.55} className="ring back" stroke={cl.color} strokeWidth={fs(1.2)} />
        )}
        <g
          className="planet"
          onClick={click(() => onFocus(focused ? null : cl.id))}
          onPointerEnter={() => setHover(cl.id)}
          onPointerLeave={() => setHover(null)}
          role="button"
          tabIndex={0}
          aria-label={`${cl.label}: ${alive.length} projects`}
          onKeyDown={(e) => e.key === "Enter" && onFocus(cl.id)}
        >
          <circle cx={p.x} cy={p.y} r={r + 22} fill="transparent" />
          {(cl.body === "cloud" || cl.body === "giant") && <circle cx={p.x} cy={p.y} r={r * 1.35} fill={cl.color} opacity={0.08} />}
          <circle cx={p.x} cy={p.y} r={r} fill={`url(#pg-${cl.id})`} />
          {cl.body === "giant" &&
            [-0.45, -0.1, 0.25, 0.55].map((b, i) => (
              <ellipse
                key={i}
                cx={p.x}
                cy={p.y + b * r}
                rx={r * Math.sqrt(1 - b * b) * 0.98}
                ry={r * 0.06}
                fill="#120f0b"
                opacity={0.18}
              />
            ))}
          {isHover && !focused && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke="#efe7d6" strokeWidth={fs(1)} opacity={0.6} />}
        </g>
        {cl.body === "ringed" && (
          <path
            d={`M ${p.x - r * 2.1} ${p.y} A ${r * 2.1} ${r * 0.55} 0 0 0 ${p.x + r * 2.1} ${p.y}`}
            className="ring"
            stroke={cl.color}
            strokeWidth={fs(1.2)}
          />
        )}
        {!focused && (
          <g className="plabel" opacity={dimmed ? 0.25 : 1}>
            <text x={p.x} y={p.y + r + fs(20)} fontSize={fs(13)} className="pname">
              {cl.label}
            </text>
            <text x={p.x} y={p.y + r + fs(34)} fontSize={fs(9.5)} className="pmeta">
              {alive.length} {alive.length === 1 ? "MOON" : "MOONS"} · {Math.round(cl.orbit / 100)} AU
            </text>
          </g>
        )}
        {renderMoons(cl, p)}
      </g>
    );
  };

  const renderMoons = (cl: Cluster, p: Pt) => {
    const focused = focusCluster === cl.id;
    const e = focused ? expand.current : 0;
    return moonsOf[cl.id].filter(born).map((n) => {
      const m = posById[n.id];
      const rr = lerp(1.6, n.weight === 3 ? 6 : n.weight === 2 ? 4.6 : 3.4, ease(e));
      const sel = n.id === selectedId;
      const related =
        activeMoon && edges.some((x) => (x.from === activeMoon && x.to === n.id) || (x.to === activeMoon && x.from === n.id));
      const labelRight = m.x >= p.x;
      return (
        <g
          key={n.id}
          className={"moon" + (focused ? " live" : "") + (sel ? " sel" : "")}
          onClick={focused ? click(() => onSelect(n.id)) : undefined}
          onPointerEnter={focused ? () => setHover(n.id) : undefined}
          onPointerLeave={focused ? () => setHover(null) : undefined}
          role={focused ? "button" : undefined}
          tabIndex={focused ? 0 : -1}
          aria-label={focused ? `${n.title}: ${n.tagline}` : undefined}
          onKeyDown={focused ? (ev) => ev.key === "Enter" && onSelect(n.id) : undefined}
        >
          {focused && e > 0.9 && (
            <line x1={p.x} y1={p.y} x2={m.x} y2={m.y} stroke={cl.color} strokeWidth={fs(0.6)} opacity={0.18} />
          )}
          {hl.has(n.id) && <circle cx={m.x} cy={m.y} r={rr + 4} className="beacon" stroke={cl.color} strokeWidth={fs(1.5)} />}
          {focused && <circle cx={m.x} cy={m.y} r={rr + 8} fill="transparent" />}
          <circle
            className="mbody"
            cx={m.x}
            cy={m.y}
            r={rr}
            fill={sel || related ? "#f6efe1" : n.status === "live" ? "#efe4cf" : "#b8ad99"}
            stroke={sel ? cl.color : "none"}
            strokeWidth={fs(2)}
            opacity={n.status === "archived" || n.status === "experiment" ? 0.6 : 1}
          />
          {n.status === "live" && focused && (
            <circle cx={m.x} cy={m.y} r={rr + 2.4} fill="none" stroke="#9cc59a" strokeWidth={fs(1)} className="livering" />
          )}
          {focused && e > 0.6 && (
            <g opacity={ease((e - 0.6) / 0.4)}>
              <text
                x={m.x + (labelRight ? rr + fs(8) : -(rr + fs(8)))}
                y={m.y - fs(1)}
                fontSize={fs(13)}
                textAnchor={labelRight ? "start" : "end"}
                className="mname"
              >
                {n.title}
              </text>
              <text
                x={m.x + (labelRight ? rr + fs(8) : -(rr + fs(8)))}
                y={m.y + fs(12)}
                fontSize={fs(9)}
                textAnchor={labelRight ? "start" : "end"}
                className="mmeta"
              >
                {n.year} · {n.status.toUpperCase()}
              </text>
            </g>
          )}
        </g>
      );
    });
  };

  // Gravitational links: only drawn for the moon in focus, so the view stays quiet.
  const links = activeMoon
    ? edges
        .filter((x) => x.from === activeMoon || x.to === activeMoon)
        .filter((x) => posById[x.from] && posById[x.to] && born(nodeById[x.from]) && born(nodeById[x.to]))
    : [];

  const viewBox = `${c.x - vw / 2} ${c.y - vh / 2} ${vw} ${vh}`;
  const sunHover = hover === "sun";

  // HUD readouts
  const alt = (9.4 / c.k).toFixed(2);
  const lon = ((c.x / 6 + 360) % 360).toFixed(1);
  const lat = (-c.y / 6).toFixed(1);
  const scaleUnits = 100 / (scalePx * c.k);
  const focusedCl = focusCluster ? clusterOf[focusCluster] : null;
  const selNode = selectedId ? nodeById[selectedId] : null;

  return (
    <>
      <svg
        ref={svgRef}
        className="universe"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        role="img"
        aria-label="Puneet's universe: the Sun is Puneet, planets are areas of work, moons are projects"
      >
        <defs>
          <radialGradient id="sunCorona">
            <stop offset="0%" stopColor="#fff3d6" stopOpacity="0.55" />
            <stop offset="30%" stopColor="#f0c27a" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f0c27a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sunCore" fx="0.42" fy="0.4">
            <stop offset="0%" stopColor="#fffaf0" />
            <stop offset="55%" stopColor="#f6d79c" />
            <stop offset="100%" stopColor="#e3a85a" />
          </radialGradient>
        </defs>

        {/* Orbits */}
        {clusters.map((cl) => {
          const alive = moonsOf[cl.id].some(born);
          const on = hover === cl.id || focusCluster === cl.id;
          return (
            <ellipse
              key={cl.id}
              rx={cl.orbit}
              ry={cl.orbit * TILT}
              className={"orbit" + (on ? " on" : "") + (alive ? "" : " unborn")}
              strokeWidth={fs(on ? 1.2 : 0.8)}
              stroke={on ? cl.color : undefined}
            />
          );
        })}

        {behind.map(renderPlanet)}

        {/* The Sun — Puneet */}
        <g
          className={"sun" + (focusCluster ? " far" : "")}
          onClick={click(() => (focusCluster ? onFocus(null) : onSelect("puneet")))}
          onPointerEnter={() => setHover("sun")}
          onPointerLeave={() => setHover(null)}
          role="button"
          tabIndex={0}
          aria-label="Puneet Sharma — open profile"
        >
          <circle r={150} fill="url(#sunCorona)" className="corona" />
          <circle r={34} fill="url(#sunCore)" />
          {sunHover && <circle r={40} fill="none" stroke="#f6d79c" strokeWidth={fs(1)} opacity={0.6} />}
          {!focusCluster && (
            <>
              <text y={58} fontSize={fs(14)} className="sname">
                Puneet Sharma
              </text>
              <text y={58 + fs(15)} fontSize={fs(9.5)} className="pmeta">
                THE SUN · EVERYTHING ORBITS THE WORK
              </text>
            </>
          )}
        </g>

        {front.map(renderPlanet)}

        {links.map((x) => {
          const a = posById[x.from];
          const b = posById[x.to];
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - Math.hypot(a.x - b.x, a.y - b.y) * 0.25;
          return (
            <path
              key={x.from + x.to}
              d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`}
              className="gravity"
              strokeWidth={fs(1.1)}
              strokeDasharray={`${fs(3)} ${fs(5)}`}
            />
          );
        })}
      </svg>

      {/* ── Google-Earth-style HUD ── */}
      <nav className="crumbs" aria-label="Location">
        <button onClick={() => onFocus(null)}>Observable universe</button>
        <span>/</span>
        <button onClick={() => onFocus(null)} className={!focusedCl ? "here" : ""}>
          Sol · Puneet
        </button>
        {focusedCl && (
          <>
            <span>/</span>
            <button className={!selNode ? "here" : ""} onClick={() => onFocus(focusedCl.id)}>
              {focusedCl.label}
            </button>
          </>
        )}
        {selNode && focusedCl && selNode.cluster === focusedCl.id && (
          <>
            <span>/</span>
            <span className="here">{selNode.title}</span>
          </>
        )}
      </nav>

      <div className="hud-coords" aria-hidden="true">
        <span>ALT {alt} AU</span>
        <span>LAT {lat}°</span>
        <span>LON {lon}°</span>
        <span>T {year}</span>
        <span className="scalebar">
          <i />
          {scaleUnits >= 1 ? `${Math.round(scaleUnits)} u` : `${scaleUnits.toFixed(1)} u`}
        </span>
      </div>

      <div className="hud-zoom">
        <div className="compass" aria-hidden="true">
          <span>N</span>
          <i />
        </div>
        <button onClick={() => zoomBy(1.4)} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
          −
        </button>
        <button onClick={() => (focusCluster ? onFocus(null) : flyTo(SYSTEM))} aria-label="Back to the whole system">
          ⌂
        </button>
      </div>

      {focusedCl && (
        <div className="planet-card" style={{ ["--accent" as string]: focusedCl.color }}>
          <span className="eyebrow-s">PLANET · {Math.round(focusedCl.orbit / 100)} AU FROM THE SUN</span>
          <h2>{focusedCl.label}</h2>
          <p>{focusedCl.kicker}</p>
          <span className="hint">Click a moon to open its case file</span>
        </div>
      )}
    </>
  );
}
