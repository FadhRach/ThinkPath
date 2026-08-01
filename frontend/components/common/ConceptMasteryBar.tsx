import { masteryBarClass, masteryTextClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  percent: number;
}

// Baris label + bar berwarna sesuai ambang penguasaan.
export function ConceptMasteryBar({ label, percent }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-body-sm">
        <span className="text-foreground">{label}</span>
        <span className={cn("font-semibold", masteryTextClass(clamped))}>
          {clamped}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", masteryBarClass(clamped))}
          style={{ width: `${Math.max(3, clamped)}%` }}
        />
      </div>
    </div>
  );
}
