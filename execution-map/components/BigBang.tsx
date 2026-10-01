"use client";

import { useEffect, useRef, useState } from "react";

const LINES = [
  { at: 1100, text: "Every universe begins with a single point." },
  { at: 2700, text: "Puneet's began in a call centre." },
  { at: 4200, text: "Everything that formed since is still in orbit." },
];
const DURATION = 5900;

/** Singularity → flash → expanding matter that cools into the starfield. Canvas only. */
export default function BigBang({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [line, setLine] = useState(-1);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    setTimeout(onDone, 700);
  };

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = w / 2;
    const cy = h / 2;
    const t0 = performance.now();
    const BANG = 900;

    const N = Math.round(Math.min(1400, (w * h) / 900));
    const parts = Array.from({ length: N }, () => {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.pow(Math.random(), 0.6) * Math.max(w, h) * 0.0125;
      return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, size: Math.random() * 1.4 + 0.3, heat: Math.random() };
    });

    let raf = 0;
    const timers = LINES.map((l, i) => setTimeout(() => setLine(i), l.at));
    const end = setTimeout(finish, DURATION);

    const frame = (now: number) => {
      const t = now - t0;
      ctx.fillStyle = "rgba(9,8,7,0.32)";
      ctx.fillRect(0, 0, w, h);

      if (t < BANG) {
        // The singularity: a breathing point of light.
        const r = 1.5 + (t / BANG) * 4 + Math.sin(t / 60) * 0.6;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 10);
        g.addColorStop(0, "rgba(255,250,235,1)");
        g.addColorStop(0.15, "rgba(246,215,156,0.6)");
        g.addColorStop(1, "rgba(246,215,156,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const since = t - BANG;
        if (since < 500) {
          // The flash.
          const k = 1 - since / 500;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * (0.2 + since / 600));
          g.addColorStop(0, `rgba(255,248,230,${0.9 * k})`);
          g.addColorStop(0.4, `rgba(240,194,122,${0.35 * k})`);
          g.addColorStop(1, "rgba(200,113,75,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
        const cool = Math.min(1, since / 2600);
        for (const p of parts) {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.982;
          p.vy *= 0.982;
          // White-hot → gold → ember → cool starlight
          const hot = Math.max(0, 1 - cool - p.heat * 0.3);
          const r = Math.round(255 - (1 - hot) * 20);
          const gC = Math.round(lerp(200, 238, 1 - hot) - hot * 10);
          const b = Math.round(lerp(120, 222, 1 - hot));
          ctx.fillStyle = `rgba(${r},${gC},${b},${0.35 + 0.6 * (1 - cool * 0.5)})`;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={"bigbang" + (leaving ? " leaving" : "")} onClick={finish} role="presentation">
      <canvas ref={ref} />
      <div className="bb-text">
        {LINES.map((l, i) => (
          <p key={i} className={i === line ? "on" : i < line ? "past" : ""}>
            {l.text}
          </p>
        ))}
      </div>
      <button className="bb-skip" onClick={finish}>
        skip intro →
      </button>
      <div className="bb-time">t = {line < 0 ? "0" : line === 0 ? "10⁻⁴³ s" : line === 1 ? "2016" : "2026"}</div>
    </div>
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
