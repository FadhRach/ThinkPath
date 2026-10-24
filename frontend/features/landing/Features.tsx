import {
  ClipboardList,
  FileUp,
  Layers,
  Mic,
  Route,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";

import type { Copy, FeatureKey } from "./types";

const ICONS: Record<FeatureKey, LucideIcon> = {
  process: Route,
  bloom: Layers,
  cekpaham: Mic,
  ai: ScanSearch,
  summary: ClipboardList,
  import: FileUp,
};

// Ukuran sel bento mengikuti bobot fitur: jejak proses paling besar.
const CELL: Record<FeatureKey, string> = {
  process: "lp-feature lp-feature--lg lp-span-3 lp-row-2",
  bloom: "lp-feature lp-feature--md lp-span-3",
  cekpaham: "lp-feature lp-feature--md lp-span-3",
  ai: "lp-feature lp-span-2",
  summary: "lp-feature lp-span-2",
  import: "lp-feature lp-span-2",
};

const WAVE = [
  6, 14, 9, 22, 30, 18, 26, 12, 34, 20, 8, 24, 32, 16, 10, 28, 20, 12, 6, 18, 26, 14, 8, 20,
];
const CURVE =
  "M4 124 C40 122 60 108 90 100 S130 90 150 76 L162 84 C190 66 215 56 240 40 L250 48 C270 34 295 22 316 14";

function Wave() {
  return (
    <div aria-hidden="true" className="lp-wave">
      {WAVE.map((height, index) => (
        <i key={index} style={{ height }} />
      ))}
    </div>
  );
}

function BloomBars() {
  return (
    <div aria-hidden="true" className="lp-bloom">
      {[1, 2, 3, 4, 5, 6].map((level) => (
        <div key={level} className={level === 4 ? "on" : undefined}>
          <i style={{ height: `${28 + level * 11}%` }} />L{level}
        </div>
      ))}
    </div>
  );
}

function MiniCurve() {
  return (
    <svg viewBox="0 0 320 140" aria-hidden="true" className="lp-minicurve">
      {[35, 70, 105].map((y) => (
        <line
          key={y}
          x1="0"
          x2="320"
          y1={y}
          y2={y}
          stroke="var(--lp-border)"
          strokeDasharray="3 5"
        />
      ))}
      <line x1="0" x2="320" y1="132" y2="132" stroke="var(--lp-border)" />
      <path d={`${CURVE} L316 132 L4 132 Z`} fill="currentColor" fillOpacity="0.12" />
      <path
        d={CURVE}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        [162, 84],
        [250, 48],
      ].map(([x, y]) => (
        <circle
          key={x}
          cx={x}
          cy={y}
          r="3.5"
          fill="var(--lp-surface)"
          stroke="currentColor"
          strokeWidth="2"
        />
      ))}
      <circle cx="316" cy="14" r="4.5" fill="currentColor" />
    </svg>
  );
}

export function Features({ copy }: { copy: Copy["features"] }) {
  return (
    <section id="fitur" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-head">
          <h2 className="lp-h2">{copy.title}</h2>
          <p className="lp-lead">{copy.lead}</p>
        </div>
        <div className="lp-bento">
          {copy.items.map((item) => {
            const Icon = ICONS[item.key];
            return (
              <article key={item.key} className={CELL[item.key]}>
                <div className="lp-feature-head">
                  <Icon aria-hidden="true" />
                  <h3>{item.title}</h3>
                </div>
                <p>{item.body}</p>
                {item.key === "process" ? (
                  <div className="lp-feature-visual">
                    <MiniCurve />
                  </div>
                ) : null}
                {item.key === "bloom" ? (
                  <div className="lp-feature-visual">
                    <BloomBars />
                  </div>
                ) : null}
                {item.key === "cekpaham" ? (
                  <div className="lp-feature-visual">
                    <Wave />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
