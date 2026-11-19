"use client";

import { useRef, useState } from "react";

// "How it works" walkthrough: three Hindi videos that follow one block from the quarry to the depot.
// Order always mine → manufacturing unit → distribution. Files live in /public/videos.
const VIDEOS = [
  { key: "mine", step: "1", label: "Mine / quarry", title: "Every block counted at the quarry", time: "5:27" },
  { key: "manufacturing", step: "2", label: "Manufacturing unit", title: "Block to slab, at the real cost per sq ft", time: "4:48" },
  { key: "distribution", step: "3", label: "Distribution / depot", title: "Slab stock to the customer’s invoice", time: "4:57" },
] as const;

export default function HowVideos() {
  const [i, setI] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const v = VIDEOS[i];

  // Switching chapters is a click, so the browser lets the new video start playing straight away.
  const pick = (n: number) => {
    if (n === i) { ref.current?.play().catch(() => {}); return; }
    setStarted(true);
    setI(n);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-10">
      <div className="flex min-w-0 flex-col">
        <div role="tablist" aria-label="Walkthrough videos" className="flex flex-col gap-1.5">
          {VIDEOS.map((x, n) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={n === i}
              aria-controls="how-video"
              onClick={() => pick(n)}
              className={`focusable group flex min-h-[52px] w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition-[background-color,color,transform] active:scale-[0.99] ${n === i ? "bg-surface text-ink" : "text-ink-2 hover:bg-surface/60 hover:text-ink"}`}
            >
              <span className={`num grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors ${n === i ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-2 group-hover:text-ink"}`}>{x.step}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{x.label}</span>
                <span className="block text-sm text-ink-3">{x.title}</span>
              </span>
              <span className="num shrink-0 text-sm text-ink-3">{x.time}</span>
            </button>
          ))}
        </div>
      </div>

      <div id="how-video" role="tabpanel" aria-label={v.label} className="rounded-[28px] bg-surface p-2 shadow-[0_30px_80px_-30px_rgba(15,20,18,0.35)] sm:p-2.5">
        <video
          key={v.key}
          ref={ref}
          className="aspect-video w-full rounded-[22px] bg-night"
          src={`/videos/${v.key}.mp4`}
          poster={`/videos/${v.key}.webp`}
          controls
          playsInline
          preload={started ? "auto" : "none"}
          autoPlay={started}
          onPlay={() => setStarted(true)}
          onEnded={() => { if (i < VIDEOS.length - 1) setI(i + 1); }}
          aria-label={`${v.label}: ${v.title}`}
        />
      </div>
    </div>
  );
}
