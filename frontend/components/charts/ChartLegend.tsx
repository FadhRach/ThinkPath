import { cn } from "@/lib/utils";

export interface LegendItem {
  label: string;
  color: string;
  /** Bentuk penanda mengikuti bentuk seri di grafik. */
  shape?: "line" | "dashed" | "dot" | "square";
}

/**
 * Legenda grafik sebagai HTML biasa, bukan label di dalam SVG.
 *
 * Label yang ditempel pada garis acuan Recharts tidak tahu posisi titik data,
 * jadi mudah bertabrakan dengan titik atau label batang. Legenda di luar area
 * gambar tidak pernah menutupi data, dan tetap terbaca di layar sempit.
 */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-caption text-muted-foreground">
          <Swatch color={item.color} shape={item.shape ?? "square"} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function Swatch({ color, shape }: { color: string; shape: NonNullable<LegendItem["shape"]> }) {
  if (shape === "line" || shape === "dashed") {
    return (
      <svg width="18" height="8" aria-hidden="true" className="shrink-0">
        <line
          x1="1"
          y1="4"
          x2="17"
          y2="4"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={shape === "dashed" ? "4 3" : undefined}
        />
      </svg>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("h-2.5 w-2.5 shrink-0", shape === "dot" ? "rounded-full" : "rounded-[3px]")}
      style={{ backgroundColor: color }}
    />
  );
}
