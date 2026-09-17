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

/**
 * Cincin skor indikasi AI, 0 sampai 100.
 *
 * Sengaja tanpa tanda persen dan tanpa kata "probabilitas". Skor ini jumlah
 * sinyal berbobot, bukan peluang terkalibrasi; "62%" terbaca sebagai "62 persen
 * kemungkinan memakai AI", klaim yang tidak bisa dipertanggungjawabkan.
 */
export function AiScoreRing({ score, band, size = 160 }: Props) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const dash = (clamped / 100) * circumference;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Skor indikasi AI ${clamped} dari 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
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
        <span className={cn("text-4xl font-extrabold leading-none", BAND_TEXT[band])}>
          {clamped}
        </span>
        <span className="mt-1 text-caption text-muted-foreground">dari 100</span>
        <span className="text-caption font-medium text-muted-foreground">
          Skor indikasi AI
        </span>
      </div>
    </div>
  );
}
