import { cn } from "@/lib/utils";

interface ClassProgressProps {
  done: number;
  total: number;
  className?: string;
}

/** Bilah progres tugas yang sudah dikumpulkan. */
export function ClassProgress({ done, total, className }: ClassProgressProps) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">
          {total ? `${done} dari ${total} tugas dikumpulkan` : "Belum ada tugas"}
        </span>
        <span className="font-semibold tabular-nums text-brand-ink">
          {total ? `${percent}%` : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progres tugas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
