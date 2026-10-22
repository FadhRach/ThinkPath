import { cn } from "@/lib/utils";

/** Meter level suara. Skala akar supaya ucapan biasa terlihat jelas, bukan hanya teriakan. */
export function MicMeter({ level, className }: { level: number; className?: string }) {
  const percent = Math.min(100, Math.round(Math.sqrt(level) * 140));
  return (
    <div
      role="meter"
      aria-label="Level suara mikrofon"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-3 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-100"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
