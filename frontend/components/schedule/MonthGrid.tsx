import { EventChip } from "@/components/schedule/EventChip";
import {
  WEEKDAY_SHORT,
  dayOfMonth,
  formatDayKeyLong,
  isSameMonth,
  type CalendarRange,
} from "@/lib/calendar";
import { AGENDA_STYLE, agendaState } from "@/lib/schedule";
import type { ScheduleItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  range: CalendarRange;
  today: string;
  byDay: Map<string, ScheduleItem[]>;
  now: Date;
  /** Tautan ke rincian satu hari di daftar agenda. Hari dari bulan lain
   *  mengarah ke bulannya sendiri, karena daftar agenda hanya memuat bulan ini. */
  dayHref: (key: string) => string;
}

// Lebih dari ini, kotak tanggal menampilkan "+N lainnya" dan rinciannya
// dibaca di daftar agenda, seperti tampilan bulan Google Calendar.
const MAX_CHIPS = 3;

export function MonthGrid({ range, today, byDay, now, dayHref }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAY_SHORT.map((name) => (
          <p
            key={name}
            className="py-2 text-center text-caption font-semibold text-muted-foreground"
          >
            {name}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {range.days.map((key) => {
          const items = byDay.get(key) ?? [];
          const inMonth = isSameMonth(key, range.anchor);
          const isToday = key === today;
          const shown = items.length > MAX_CHIPS ? MAX_CHIPS - 1 : MAX_CHIPS;
          const label = `${formatDayKeyLong(key)}, ${items.length} agenda`;
          return (
            <div
              key={key}
              className={cn(
                "relative min-h-[3.5rem] min-w-0 p-1 sm:min-h-[6.75rem] sm:p-1.5",
                inMonth ? "bg-card" : "bg-muted/50",
              )}
            >
              {/* Ponsel: seluruh kotak menjadi tautan ke agenda hari itu. */}
              {items.length > 0 ? (
                <a href={dayHref(key)} aria-label={label} className="absolute inset-0 sm:hidden" />
              ) : null}
              <div className="flex justify-center sm:justify-start">
                <span
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-body-sm tabular-nums",
                    isToday
                      ? "bg-primary font-bold text-primary-foreground"
                      : inMonth
                        ? "font-medium text-foreground"
                        : "text-muted-foreground/70",
                  )}
                >
                  {dayOfMonth(key)}
                </span>
              </div>

              {items.length > 0 ? (
                <div aria-hidden="true" className="mt-1 flex justify-center gap-0.5 sm:hidden">
                  {items.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        AGENDA_STYLE[agendaState(item, now)].mark,
                      )}
                    />
                  ))}
                </div>
              ) : null}

              <div className="mt-1 hidden space-y-1 sm:block">
                {items.slice(0, shown).map((item) => (
                  <EventChip key={item.id} item={item} now={now} variant="month" />
                ))}
                {items.length > shown ? (
                  <a
                    href={dayHref(key)}
                    className="block rounded px-1.5 text-[0.6875rem] font-semibold text-muted-foreground hover:text-primary"
                  >
                    +{items.length - shown} lainnya
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
