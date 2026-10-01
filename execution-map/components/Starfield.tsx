"use client";

import { useEffect, useRef } from "react";

/** Quiet, twinkling starfield with gentle mouse parallax. Pure canvas, no deps. */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type P = { x: number; y: number; z: number; vx: number; vy: number };
    let pts: P[] = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 5200);
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.9 + 0.1,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
      }));
    };

    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / w - 0.5) * 2;
      mouse.ty = (e.clientY / h - 0.5) * 2;
    };

    const frame = () => {
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      ctx.clearRect(0, 0, w, h);
      const proj = pts.map((p) => {
        if (!reduce) {
          p.x = (p.x + p.vx * p.z + w) % w;
          p.y = (p.y + p.vy * p.z + h) % h;
        }
        return { x: p.x - mouse.x * 10 * p.z, y: p.y - mouse.y * 10 * p.z, z: p.z };
      });
      const tt = performance.now() / 1000;
      for (let i = 0; i < proj.length; i++) {
        const a = proj[i];
        const tw = 0.65 + 0.35 * Math.sin(tt * (0.6 + (i % 7) * 0.25) + i);
        const warm = i % 5 === 0;
        ctx.fillStyle = warm
          ? `rgba(255,226,186,${(0.25 + a.z * 0.55) * tw})`
          : `rgba(232,232,240,${(0.12 + a.z * 0.45) * tw})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.z * (warm ? 1.25 : 0.95), 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    resize();
    frame();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
