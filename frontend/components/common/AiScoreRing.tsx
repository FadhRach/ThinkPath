import type { AiBand } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  score: number;
  band: AiBand;
  size?: number;
}

const BAND_STROKE: Record<AiBand, string> = {
  low: "stroke-success",
  mid: "stroke-warning",
  high: "stroke-danger",
};

const BAND_TEXT: Record<AiBand, string> = {
  low: "text-success",
  mid: "text-warning",
  high: "text-danger",
};

// Cincin progres SVG untuk probabilitas AI.
export function AiScoreRing({ score, band, size = 160 }: Props) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className={cn("transition-all", BAND_STROKE[band])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-extrabold", BAND_TEXT[band])}>
          {clamped}%
        </span>
        <span className="text-xs text-muted-foreground">Probabilitas AI</span>
      </div>
    </div>
  );
}
