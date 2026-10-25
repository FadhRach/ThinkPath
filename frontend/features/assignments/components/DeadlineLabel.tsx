"use client";

import { CalendarClock } from "lucide-react";

import { useDeadline } from "@/hooks/use-deadline";
import { formatCountdown, formatDate } from "@/lib/formatting";
import { cn } from "@/lib/utils";

/** Tenggat dengan hitung mundur hidup: tanggal, sisa waktu, dan warna yang makin mendesak. */
export function DeadlineLabel({
  deadline,
  finished = false,
}: {
  deadline: string | null;
  /** Sudah dikumpulkan atau dinilai: hitung mundur tidak lagi relevan. */
  finished?: boolean;
}) {
  const { expired, remainingMs } = useDeadline(deadline);

  if (!deadline) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        Tanpa tenggat
      </span>
    );
  }

  const urgent = !finished && !expired && remainingMs !== null && remainingMs < 48 * 3_600_000;
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm",
        !finished && expired
          ? "font-semibold text-danger"
          : urgent
            ? "font-semibold text-warning"
            : "text-muted-foreground",
      )}
    >
      <CalendarClock className="h-4 w-4" aria-hidden="true" />
      <span>Tenggat {formatDate(deadline)}</span>
      {finished ? null : expired ? (
        <span>· sudah lewat</span>
      ) : remainingMs !== null ? (
        <span>· sisa {formatCountdown(remainingMs)}</span>
      ) : null}
    </span>
  );
}
