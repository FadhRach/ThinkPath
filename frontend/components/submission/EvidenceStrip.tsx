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

export function EvidenceStrip({ rows }: Props) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label} className="flex items-start gap-3">
          <span className="caption-eyebrow w-16 pt-1 text-muted-foreground">
            {row.label}
          </span>
          <span
            className={cn(
              "mt-1.5 block h-2.5 w-2.5 shrink-0 rounded-full",
              aiBandBarClass(row.band),
            )}
          />
          <span className="text-body-sm text-foreground">{row.detail}</span>
        </li>
      ))}
    </ul>
  );
}
