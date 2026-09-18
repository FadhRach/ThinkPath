import { cn } from "@/lib/utils";

export interface GradePoint {
  label: string;
  /** Konteks singkat, misalnya nama kelas. */
  sublabel?: string;
  value: number;
}

interface Props {
  data: GradePoint[];
}

/**
 * Nilai tugas terakhir sebagai batang mendatar.
 *
 * Dulu batang tegak Recharts dengan nama mata kuliah di sumbu datar: label
 * panjang saling tumpuk, Recharts menyembunyikan sebagian, dan tugas berbeda
 * dari mata kuliah yang sama tampil dengan label kembar. Baris mendatar
 * memberi ruang untuk judul tugas yang sebenarnya dan tidak butuh pustaka grafik.
 * Nilai tertinggi tetap diberi teal penuh.
 */
export function GradeBarChart({ data }: Props) {
  const max = Math.max(...data.map((point) => point.value), 0);

  return (
    <ul className="space-y-3.5">
      {data.map((point, index) => (
        <li key={`${point.label}-${index}`} className="space-y-1.5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body-sm font-medium text-foreground" title={point.label}>
                {point.label}
              </p>
              {point.sublabel ? (
                <p className="truncate text-caption text-muted-foreground">{point.sublabel}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-body font-bold tabular-nums text-foreground">
              {point.value}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                point.value === max ? "bg-primary" : "bg-brand-teal-light",
              )}
              style={{ width: `${Math.max(0, Math.min(100, point.value))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
