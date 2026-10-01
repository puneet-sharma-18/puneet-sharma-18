"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clusters, nodes, person } from "@/data/profile";

export interface Action {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  actions: Action[];
  onOpenNode: (id: string) => void;
}

const color = Object.fromEntries(clusters.map((c) => [c.id, c.color]));

export default function CommandPalette({ open, onClose, actions, onOpenNode }: Props) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => ref.current?.focus(), 20);
    }
  }, [open]);

  const items = useMemo(() => {
    const needle = q.toLowerCase().trim();
    const nodeItems = nodes.map((n) => ({
      id: n.id,
      label: n.title,
      hint: n.tagline,
      dot: color[n.cluster],
      run: () => onOpenNode(n.id),
      text: `${n.title} ${n.tagline} ${n.stack?.join(" ")} ${n.cluster}`.toLowerCase(),
    }));
    const actionItems = actions.map((a) => ({ ...a, dot: "#ffffff", text: `${a.label} ${a.hint}`.toLowerCase() }));
    const all = [...actionItems, ...nodeItems];
    if (!needle) return all;
    return all.filter((i) => needle.split(/\s+/).every((w) => i.text.includes(w)));
  }, [q, actions, onOpenNode]);

  if (!open) return null;

  const go = (i: number) => {
    const it = items[i];
    if (!it) return;
    onClose();
    it.run();
  };

  return (
    <div className="cmdk-wrap" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="cmdk-in">
          <span>⌘</span>
          <input
            ref={ref}
            value={q}
            placeholder={`Search ${nodes.length} projects, stacks, or actions…`}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") go(idx);
              else if (e.key === "Escape") onClose();
            }}
          />
          <kbd>esc</kbd>
        </div>
        <ul className="cmdk-list">
          {items.length === 0 && (
            <li className="cmdk-empty">
              Nothing matches. Ask Jarvis instead — or mail {person.email}.
            </li>
          )}
          {items.map((it, i) => (
            <li key={it.id}>
              <button className={i === idx ? "on" : ""} onMouseEnter={() => setIdx(i)} onClick={() => go(i)}>
                <i style={{ background: it.dot, boxShadow: `0 0 8px ${it.dot}` }} />
                <b>{it.label}</b>
                <span>{it.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
