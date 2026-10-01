"use client";

import { useEffect, useState } from "react";

const LINES = [
  "> initialising execution map…",
  "> indexing 28 repositories · 338k lines of code",
  "> loading brands, deals, events, AI systems",
  "> verifying receipts",
  "> JARVIS online.",
];

export default function Boot({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (n >= LINES.length) {
      const t = setTimeout(onDone, 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN(n + 1), n === 0 ? 250 : 380);
    return () => clearTimeout(t);
  }, [n, onDone]);

  return (
    <div className="boot" onClick={onDone} role="presentation">
      <div className="boot-box">
        <div className="boot-title">PUNEET SHARMA // EXECUTION MAP</div>
        {LINES.slice(0, n).map((l) => (
          <div key={l} className="boot-line">
            {l}
          </div>
        ))}
        <div className="boot-bar">
          <span style={{ width: `${(n / LINES.length) * 100}%` }} />
        </div>
        <div className="boot-skip">click to skip</div>
      </div>
    </div>
  );
}
