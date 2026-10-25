import { Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { bloomCode, bloomShortLabel } from "@/features/bloom/lib/bloom";

/**
 * Target kognitif tugas dibandingkan dengan level hasil jawaban. Level hasil hanya ada setelah
 * jawaban dianalisis dan dinilai; tanpa itu hanya targetnya yang tampil.
 */
export function CognitiveTarget({ target, achieved }: { target: number; achieved: number | null }) {
  const reached = achieved !== null && achieved >= target;
  return (
    <div className="space-y-1.5 text-sm">
      <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
        <Target className="h-4 w-4 text-brand-ink" aria-hidden="true" />
        Target kognitif {bloomCode(target)}
        <span className="font-normal text-muted-foreground">{bloomShortLabel(target)}</span>
      </p>
      {achieved !== null ? (
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">
            Hasil jawabanmu {bloomCode(Math.round(achieved))}{" "}
            {bloomShortLabel(Math.round(achieved))}
          </span>
          <Badge tone={reached ? "success" : "warning"} size="sm">
            {reached
              ? Math.round(achieved) > target
                ? "Melampaui target"
                : "Sesuai target"
              : `${target - Math.round(achieved)} level di bawah target`}
          </Badge>
        </p>
      ) : null}
    </div>
  );
}
