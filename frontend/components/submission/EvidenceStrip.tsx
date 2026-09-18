import { aiBandBarClass } from "@/lib/ui";
import type { AiBand } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Row {
  label: string;
  band: AiBand;
  detail: string;
}

interface Props {
  rows: Row[];
}

/** Tiga sumbu bukti dalam satu tatapan: proses, teks, dan level kognitif. */
export function EvidenceStrip({ rows }: Props) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li
          key={row.label}
          className="grid grid-cols-[4.5rem_auto_1fr] items-start gap-x-2.5 py-2.5 first:pt-0 last:pb-0"
        >
          <span className="pt-0.5 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
            {row.label}
          </span>
          <span
            aria-hidden="true"
            className={cn("mt-1.5 block h-2.5 w-2.5 rounded-full", aiBandBarClass(row.band))}
          />
          <span className="text-body-sm text-foreground">{row.detail}</span>
        </li>
      ))}
    </ul>
  );
}
