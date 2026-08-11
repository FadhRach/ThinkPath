interface Segment {
  label: string;
  count: number;
  /** Kelas Tailwind untuk warna batang. */
  tone: string;
}

interface Props {
  segments: Segment[];
  total: number;
}

/**
 * Batang sebaran proporsional dengan legenda angka.
 *
 * Selalu menampilkan jumlah absolut di samping persentase. Persentase tanpa
 * penyebut menyesatkan: "50% indikasi tinggi" dari dua submission bukan temuan,
 * itu kebetulan.
 */
export function DistributionBar({ segments, total }: Props) {
  if (total <= 0) {
    return (
      <p className="text-body-sm text-muted-foreground">
        Belum ada submission yang dianalisis.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((segment) =>
          segment.count > 0 ? (
            <div
              key={segment.label}
              className={segment.tone}
              style={{ width: `${(segment.count / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((segment) => (
          <li
            key={segment.label}
            className="flex items-center gap-2 text-body-sm text-muted-foreground"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${segment.tone}`} />
            {segment.label}
            <span className="font-semibold tabular-nums text-foreground">
              {segment.count}
            </span>
            <span className="tabular-nums">
              ({Math.round((segment.count / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
