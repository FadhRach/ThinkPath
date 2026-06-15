import type { AiBand } from "@/lib/types";

const BAND_COLOR: Record<AiBand, string> = {
  low: "bg-signal-low",
  mid: "bg-signal-mid",
  high: "bg-signal-high",
};

interface Row {
  label: string;
  band: AiBand;
  detail: string;
}

interface Props {
  rows: Row[];
}

export function EvidenceStrip({ rows }: Props) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label} className="flex items-start gap-3">
          <span className="caption-eyebrow w-20 pt-1">{row.label}</span>
          <span className={`mt-1 block w-3 h-3 rounded-full shrink-0 ${BAND_COLOR[row.band]}`} />
          <span className="text-body text-ink">{row.detail}</span>
        </li>
      ))}
    </ul>
  );
}
