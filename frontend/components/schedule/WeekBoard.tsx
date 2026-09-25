import { EventChip } from "@/components/schedule/EventChip";
import {
  WEEKDAY_SHORT,
  dayOfMonth,
  formatDayKeyLong,
  type CalendarRange,
} from "@/lib/calendar";
import type { ScheduleItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  range: CalendarRange;
  today: string;
  byDay: Map<string, ScheduleItem[]>;
  now: Date;
}

function DayBadge({ index, dayKey, today, size }: {
  index: number;
  dayKey: string;
  today: string;
  size: "lg" | "md";
}) {
  const isToday = dayKey === today;
  return (
    <>
      <span
        className={cn(
          "block text-caption font-semibold",
          isToday ? "text-primary" : "text-muted-foreground",
        )}
      >
        {WEEKDAY_SHORT[index]}
      </span>
      <span
        aria-current={isToday ? "date" : undefined}
        className={cn(
          "mx-auto mt-1 grid place-items-center rounded-full tabular-nums",
          size === "lg" ? "h-10 w-10 text-xl" : "h-9 w-9 text-lg",
          isToday ? "bg-primary font-bold text-primary-foreground" : "text-foreground",
        )}
      >
        {dayOfMonth(dayKey)}
      </span>
    </>
  );
}

/** Satu pekan: tujuh kolom di layar lebar, daftar per hari di layar sempit. */
export function WeekBoard({ range, today, byDay, now }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="hidden lg:grid lg:grid-cols-7 lg:gap-px lg:bg-border">
        {range.days.map((key, index) => {
          const items = byDay.get(key) ?? [];
          return (
            <section
              key={key}
              aria-label={formatDayKeyLong(key)}
              className="flex min-h-[24rem] min-w-0 flex-col bg-card"
            >
              <header className="border-b border-border px-2 py-3 text-center">
                <DayBadge index={index} dayKey={key} today={today} size="lg" />
              </header>
              <div className="flex-1 space-y-2 p-2">
                {items.map((item) => (
                  <EventChip key={item.id} item={item} now={now} variant="week" />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <ol className="divide-y divide-border lg:hidden">
        {range.days.map((key, index) => {
          const items = byDay.get(key) ?? [];
          return (
            <li key={key} className="flex gap-3 px-3 py-3 sm:px-4">
              <div className="w-11 shrink-0 text-center">
                <DayBadge index={index} dayKey={key} today={today} size="md" />
              </div>
              <div className="min-w-0 flex-1 space-y-2 self-center">
                {items.length === 0 ? (
                  <p className="text-body-sm text-muted-foreground/70">Tidak ada agenda</p>
                ) : (
                  items.map((item) => (
                    <EventChip key={item.id} item={item} now={now} variant="week" />
                  ))
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
