"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Cluster, ClusterId, Edge, ExecNode } from "@/lib/types";
import { hubPosition, layoutNodes, type Placed } from "@/lib/layout";

interface Props {
  nodes: ExecNode[];
  clusters: Cluster[];
  edges: Edge[];
  selectedId: string | null;
  highlightIds: string[];
  year: number;
  focusCluster: ClusterId | null;
  onSelect: (id: string) => void;
  onClusterClick: (id: ClusterId) => void;
}

interface Camera {
  x: number;
  y: number;
  k: number;
}

// Shifted left of centre so the hero copy and legend don't sit on top of nodes.
const HOME: Camera = { x: -170, y: 55, k: 0.78 };

export default function ExecutionMap({
  nodes,
  clusters,
  edges,
  selectedId,
  highlightIds,
  year,
  focusCluster,
  onSelect,
  onClusterClick,
}: Props) {
  const pos = useMemo(() => layoutNodes(nodes, clusters), [nodes, clusters]);
  const clusterById = useMemo(() => Object.fromEntries(clusters.map((c) => [c.id, c])), [clusters]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [cam, setCam] = useState<Camera>(HOME);
  const camRef = useRef(cam);
  camRef.current = cam;
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const anim = useRef<number | null>(null);

  const flyTo = (target: Camera) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    const from = { ...camRef.current };
    const t0 = performance.now();
    const dur = 750;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setCam({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        k: from.k + (target.k - from.k) * e,
      });
      if (p < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };

  // Camera follows selection / cluster focus.
  useEffect(() => {
    if (selectedId && pos[selectedId]) {
      const p = pos[selectedId];
      // Keep the node left of centre — the case file covers the right side.
      flyTo({ x: p.x * 0.6 + 230, y: p.y * 0.6, k: 1.0 });
    } else if (focusCluster) {
      const h = hubPosition(clusterById[focusCluster]);
      flyTo({ x: h.x * 1.4 - 100, y: h.y * 1.4, k: 1.05 });
    } else {
      flyTo(HOME);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, focusCluster]);

  // Wheel zoom (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = camRef.current;
      const k = Math.min(3, Math.max(0.45, c.k * (e.deltaY > 0 ? 0.9 : 1.1)));
      setCam({ ...c, k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const scale = () => {
    const el = svgRef.current;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    return 1300 / Math.min(r.width, r.height * 1.3) / camRef.current.k;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      d.moved = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
    if (d.moved) {
      const s = scale();
      setCam((c) => ({ ...c, x: d.cx - dx * s, y: d.cy - dy * s }));
    }
  };
  const endDrag = () => {
    setTimeout(() => (drag.current = null), 0);
  };
  const click = (fn: () => void) => () => {
    if (drag.current?.moved) return;
    fn();
  };

  const visible = (n: ExecNode) => n.year <= year;
  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const active = hover ?? selectedId;
  const activeEdges = new Set(
    edges.filter((e) => active && (e.from === active || e.to === active)).map((e) => e.from + ">" + e.to),
  );
  const neighbours = new Set(
    edges.flatMap((e) => (active && (e.from === active || e.to === active) ? [e.from, e.to] : [])),
  );
  const hl = new Set(highlightIds);

  const vbW = 1300 / cam.k;
  const vbH = 1000 / cam.k;
  const viewBox = `${cam.x - vbW / 2} ${cam.y - vbH / 2} ${vbW} ${vbH}`;

  const curve = (a: Placed, b: Placed) => {
    // Bend DNA edges toward the core so they read as arcs, not spaghetti.
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    return `M${a.x},${a.y} Q${mx * 0.35},${my * 0.35} ${b.x},${b.y}`;
  };

  return (
    <svg
      ref={svgRef}
      className="map"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      role="img"
      aria-label="Execution map of Puneet Sharma's work"
    >
      <defs>
        <radialGradient id="coreGlow">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="35%" stopColor="#8ef0ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8ef0ff" stopOpacity="0" />
        </radialGradient>
        <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Orbit rings */}
      {[250, 420, 540, 700].map((r) => (
        <circle key={r} r={r} className="orbit" />
      ))}

      {/* Spokes: core → hubs → nodes */}
      {clusters.map((c) => {
        const h = hubPosition(c);
        return (
          <g key={c.id} className="spokes" style={{ opacity: focusCluster && focusCluster !== c.id ? 0.15 : 1 }}>
            <line x1={0} y1={0} x2={h.x} y2={h.y} stroke={c.color} className="spoke" />
            {nodes
              .filter((n) => n.cluster === c.id && visible(n))
              .map((n) => (
                <line key={n.id} x1={h.x} y1={h.y} x2={pos[n.id].x} y2={pos[n.id].y} stroke={c.color} className="spoke thin" />
              ))}
          </g>
        );
      })}

      {/* Execution DNA: how one build fed the next */}
      {edges.map((e) => {
        const a = pos[e.from];
        const b = pos[e.to];
        const na = nodeById[e.from];
        const nb = nodeById[e.to];
        if (!a || !b || !visible(na) || !visible(nb)) return null;
        const on = activeEdges.has(e.from + ">" + e.to);
        return (
          <path
            key={e.from + e.to}
            d={curve(a, b)}
            className={"dna" + (on ? " on" : "") + (active && !on ? " dim" : "")}
            stroke={clusterById[na.cluster].color}
          />
        );
      })}

      {/* Core */}
      <g className="core" onClick={click(() => onSelect("puneet"))}>
        <circle r={120} fill="url(#coreGlow)" className="pulse" />
        <circle r={46} className="core-disc" />
        <text y={-4} className="core-name">PUNEET</text>
        <text y={14} className="core-sub">SHARMA</text>
      </g>

      {/* Cluster hubs */}
      {clusters.map((c) => {
        const h = hubPosition(c);
        return (
          <g
            key={c.id}
            transform={`translate(${h.x},${h.y})`}
            className="hub"
            onClick={click(() => onClusterClick(c.id))}
            style={{ opacity: focusCluster && focusCluster !== c.id ? 0.3 : 1 }}
          >
            <circle r={h.r} stroke={c.color} />
            <text y={4} className="hub-label" fill={c.color}>
              {c.label.toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const p = pos[n.id];
        const c = clusterById[n.cluster];
        const show = visible(n);
        const isSel = n.id === selectedId;
        const dim =
          (focusCluster && focusCluster !== n.cluster) || (active && active !== n.id && !neighbours.has(n.id));
        const dist = Math.hypot(p.x, p.y);
        const vertical = Math.abs(p.x) < dist * 0.62;
        const labelLeft = !vertical && p.x < 0;
        const lx = vertical ? 0 : labelLeft ? -(p.r + 10) : p.r + 10;
        const ly = vertical ? (p.y < 0 ? -(p.r + 24) : p.r + 18) : -2;
        const anchor = vertical ? "middle" : labelLeft ? "end" : "start";
        return (
          <g
            key={n.id}
            transform={`translate(${p.x},${p.y})`}
            className={"node" + (show ? " in" : " out") + (isSel ? " sel" : "") + (hl.has(n.id) ? " hl" : "") + (dim ? " dim" : "")}
            onClick={click(() => onSelect(n.id))}
            onPointerEnter={() => setHover(n.id)}
            onPointerLeave={() => setHover(null)}
            tabIndex={show ? 0 : -1}
            role="button"
            aria-label={`${n.title}: ${n.tagline}`}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(n.id)}
          >
            {hl.has(n.id) && <circle r={p.r + 14} className="beacon" stroke={c.color} />}
            <circle r={p.r + 6} className="halo" fill={c.color} />
            <circle r={p.r} className="dot" fill="#0b0f1a" stroke={c.color} filter={isSel ? "url(#glow)" : undefined} />
            <circle r={p.r * 0.38} fill={c.color} className={"status s-" + n.status} />
            <text x={lx} y={ly} textAnchor={anchor} className="node-title">
              {n.title}
            </text>
            <text x={lx} y={ly + 15} textAnchor={anchor} className="node-meta">
              {n.year} · {n.status}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
