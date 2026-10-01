"use client";

import type { Chapter } from "@/lib/types";

interface Props {
  min: number;
  max: number;
  year: number;
  setYear: (y: number) => void;
  playing: boolean;
  onPlay: () => void;
  chapters: Chapter[];
}

export default function Timeline({ min, max, year, setYear, playing, onPlay, chapters }: Props) {
  const chapter = [...chapters].reverse().find((c) => c.year <= year) ?? chapters[0];
  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="timeline">
      <button className="play" onClick={onPlay} aria-label={playing ? "Stop journey" : "Play journey"}>
        {playing ? "■" : "▶"} <span>{playing ? "STOP" : "PLAY THE JOURNEY"}</span>
      </button>
      <div className="tl-track">
        <div className="tl-caption" key={chapter.title}>
          <b>{chapter.title}</b> <span>{chapter.text}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          aria-label="Journey year"
        />
        <div className="tl-years">
          {years.map((y) => (
            <span key={y} className={y <= year ? "on" : ""} onClick={() => setYear(y)}>
              {chapters.some((c) => c.year === y) ? "◆ " : ""}
              {y}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
