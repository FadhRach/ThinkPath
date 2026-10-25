import type { Copy } from "./types";

const CURVE =
  "M4 112 C40 110 60 96 90 88 S130 78 150 66 L162 72 C190 56 215 48 240 34 L250 40 C270 28 295 18 316 12";
// Titik revisi: tempat kurva turun sebentar sebelum naik lagi.
const REVISIONS: [number, number][] = [
  [162, 72],
  [250, 40],
  [150, 66],
];
const LEVELS = [1, 2, 3, 4, 5, 6];

// Lembar jejak: visual khas hero. Kertas berisi kutipan esai, kurva jumlah kata terhadap
// waktu, dan catatan pinggir dosen. Isinya contoh tampilan, bukan data pengguna.
export function ProcessSheet({ copy }: { copy: Copy["sheet"] }) {
  return (
    <figure className="lp-sheet">
      <div className="lp-sheet-card">
        <figcaption className="lp-sheet-head">{copy.document}</figcaption>
        <p className="lp-sheet-text">{copy.excerpt}</p>

        <div className="lp-sheet-chart">
          <small>{copy.chartLabel}</small>
          <svg viewBox="0 0 320 120" role="img" aria-label={copy.chartLabel} className="lp-trace">
            <line x1="0" y1="116" x2="320" y2="116" stroke="var(--lp-border)" />
            <path
              className="lp-trace-area"
              d={`${CURVE} L316 116 L4 116 Z`}
              fill="currentColor"
              fillOpacity="0.12"
            />
            <path
              className="lp-trace-line"
              d={CURVE}
              pathLength={1}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {REVISIONS.map(([x, y]) => (
              <circle
                key={`${x}-${y}`}
                className="lp-trace-pop"
                cx={x}
                cy={y}
                r="3.5"
                fill="var(--lp-surface)"
                stroke="currentColor"
                strokeWidth="2"
              />
            ))}
            <circle className="lp-trace-pop" cx="316" cy="12" r="4.5" fill="currentColor" />
          </svg>

          <dl className="lp-stats">
            {[copy.started, copy.duration, copy.revisions].map((item) => (
              <dd key={item}>{item}</dd>
            ))}
          </dl>

          <div className="lp-level lp-trace-pop lp-trace-late">
            <span className="lp-level-chip">{copy.level}</span>
            <span aria-hidden="true" className="lp-level-dots">
              {LEVELS.map((level) => (
                <i key={level} className={level <= 4 ? "on" : ""} />
              ))}
            </span>
          </div>
        </div>
      </div>

      <p className="lp-sheet-note">{copy.note}</p>
    </figure>
  );
}
