import { BLOOM_LEVELS, bloomCode, bloomShortLabel } from "@/lib/bloom";
import { cn } from "@/lib/utils";

interface Props {
  observedLevel?: number | null;
  targetLevel?: number | null;
}

// Segmen L1-L6: level teramati = solid teal, target = outline putus-putus.
export function BloomStepper({ observedLevel, targetLevel }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {BLOOM_LEVELS.map((level) => {
        const isObserved = level === observedLevel;
        const isTarget = level === targetLevel && !isObserved;
        return (
          <div
            key={level}
            className={cn(
              "rounded-xl border px-2 py-2.5 text-center transition",
              isObserved && "border-transparent bg-primary text-primary-foreground shadow-soft",
              isTarget && "border-dashed border-primary bg-secondary/30 text-primary",
              !isObserved && !isTarget && "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            <p className="text-xs font-semibold opacity-80">{bloomCode(level)}</p>
            <p className="text-body-sm font-semibold leading-tight">
              {bloomShortLabel(level)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
