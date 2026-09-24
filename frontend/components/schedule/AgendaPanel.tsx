import { AgendaRow } from "@/components/student/AgendaRow";
import { formatDayKeyLong, relativeDayName } from "@/lib/calendar";
import { dayKey } from "@/lib/formatting";
import type { ScheduleItem } from "@/lib/types";

interface Props {
  title: string;
  items: ScheduleItem[];
  today: string;
  now: Date;
  emptyText: string;
}

interface Day {
  key: string;
  items: ScheduleItem[];
}

function byDayInOrder(items: ScheduleItem[]): Day[] {
  const days: Day[] = [];
  for (const item of items) {
    const key = dayKey(item.at);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(item);
    else days.push({ key, items: [item] });
  }
  return days;
}

function DayGroup({ day, today, now }: { day: Day; today: string; now: Date }) {
  const relative = relativeDayName(day.key, today);
  return (
    // Target tautan dari kotak tanggal di kalender. Warna latar menandai hari
    // yang baru dilompati supaya mata tidak perlu mencarinya lagi.
    <section id={`hari-${day.key}`} className="scroll-mt-24 transition-colors target:bg-secondary/40">
      <p className="px-4 pt-3 text-caption font-semibold text-muted-foreground">
        {relative ? <span className="text-primary">{relative} · </span> : null}
        {formatDayKeyLong(day.key)}
      </p>
      {day.items.map((item) => (
        <AgendaRow key={item.id} item={item} now={now} />
      ))}
    </section>
  );
}

/**
 * Daftar agenda di samping kalender bulan. Yang akan datang di atas, karena
 * itu yang dicari saat membuka Jadwal; yang sudah lewat menyusul dari yang
 * terbaru.
 */
export function AgendaPanel({ title, items, today, now, emptyText }: Props) {
  const upcoming = byDayInOrder(items.filter((item) => dayKey(item.at) >= today));
  const past = byDayInOrder(items.filter((item) => dayKey(item.at) < today).reverse());
  const deadlines = items.filter((item) => item.kind === "deadline").length;
  const sessions = items.length - deadlines;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-bold text-foreground">{title}</h2>
        <p className="text-caption text-muted-foreground">
          {deadlines} tenggat · {sessions} sesi diskusi
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-body-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="pb-2">
          {upcoming.length > 0 ? (
            <>
              {past.length > 0 ? (
                <p className="caption-eyebrow px-4 pt-3 text-primary">Akan datang</p>
              ) : null}
              {upcoming.map((day) => (
                <DayGroup key={day.key} day={day} today={today} now={now} />
              ))}
            </>
          ) : null}
          {past.length > 0 ? (
            <>
              <p className="caption-eyebrow mt-2 border-t border-border px-4 pt-3">Sudah lewat</p>
              {past.map((day) => (
                <DayGroup key={day.key} day={day} today={today} now={now} />
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
