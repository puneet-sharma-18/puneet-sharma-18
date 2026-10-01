"use client";

import { useEffect, useState } from "react";

const GLYPHS = "!<>-_\\/[]{}—=+*^?#01ABCDEFX";

/** Text that "decrypts" into place whenever its content changes. */
export default function Scramble({ text, speed = 22 }: { text: string; speed?: number }) {
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOut(text);
      return;
    }
    let frame = 0;
    const total = text.length + 8;
    const id = setInterval(() => {
      frame++;
      setOut(
        text
          .split("")
          .map((ch, i) => (ch === " " || i < frame - 6 ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(""),
      );
      if (frame >= total) {
        clearInterval(id);
        setOut(text);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return <span aria-label={text}>{out}</span>;
}
