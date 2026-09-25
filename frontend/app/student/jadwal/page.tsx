import { Callout } from "@/components/common/Callout";
import { PageHeader } from "@/components/common/PageHeader";
import { AgendaPanel } from "@/components/schedule/AgendaPanel";
import { CalendarLegend } from "@/components/schedule/CalendarLegend";
import { CalendarToolbar } from "@/components/schedule/CalendarToolbar";
import { MonthGrid } from "@/components/schedule/MonthGrid";
import { WeekBoard } from "@/components/schedule/WeekBoard";
import {
  buildRange,
  formatMonthName,
  isSameMonth,
  itemsByDay,
  jadwalHref,
  parseDayKey,
  rangeInstants,
  type CalendarView,
} from "@/lib/calendar";
import { getStudentClasses, getStudentSchedule } from "@/lib/data";
import { dayKey } from "@/lib/formatting";

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudentSchedulePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Dihitung per permintaan, bukan sekali saat modul dimuat, supaya "hari
  // ini" tidak membeku pada hari server dinyalakan.
  const now = new Date();
  const today = dayKey(now.toISOString());
  const view: CalendarView = single(searchParams.tampilan) === "minggu" ? "minggu" : "bulan";
  const range = buildRange(view, parseDayKey(single(searchParams.tanggal)) ?? today);

  const [classes, items] = await Promise.all([
    getStudentClasses(),
    getStudentSchedule(rangeInstants(range)),
  ]);
  const requestedClass = single(searchParams.kelas);
  const selectedClass = classes.some((cls) => cls.id === requestedClass)
    ? (requestedClass as string)
    : null;
  const visible = selectedClass
    ? items.filter((item) => item.class_id === selectedClass)
    : items;
  const byDay = itemsByDay(visible);
  const hasUpcomingSession = visible.some(
    (item) => item.kind === "session" && item.status === "scheduled",
  );
  // Daftar agenda hanya memuat bulan yang sedang dibuka. Sisa pekan dari
  // bulan tetangga tetap tampil di kalender, tetapi dibaca di bulannya sendiri.
  const monthItems = visible.filter((item) => isSameMonth(dayKey(item.at), range.anchor));
  const dayHref = (key: string) =>
    isSameMonth(key, range.anchor)
      ? `#hari-${key}`
      : `${jadwalHref({ view: "bulan", date: key, kelas: selectedClass })}#hari-${key}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jadwal"
        subtitle="Tenggat tugas dan sesi diskusi jawaban dari semua kelasmu dalam satu kalender."
      />

      <CalendarToolbar
        range={range}
        classes={classes.map((cls) => ({ id: cls.id, name: cls.name }))}
        selectedClass={selectedClass}
      />

      {view === "bulan" ? (
        // Panel agenda baru berdampingan mulai layar 1280 px. Di bawah itu
        // kalender memakai lebar penuh supaya judul di kotak tanggal terbaca.
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
          <div className="min-w-0 space-y-3">
            <MonthGrid
              range={range}
              today={today}
              byDay={byDay}
              now={now}
              dayHref={dayHref}
            />
            <CalendarLegend />
          </div>
          <AgendaPanel
            title={`Agenda ${formatMonthName(range.anchor)}`}
            items={monthItems}
            today={today}
            now={now}
            emptyText="Tidak ada tenggat atau sesi diskusi di bulan ini."
          />
        </div>
      ) : (
        <div className="space-y-3">
          <WeekBoard range={range} today={today} byDay={byDay} now={now} />
          <CalendarLegend />
        </div>
      )}

      {hasUpcomingSession ? (
        <Callout variant="info" title="Tentang sesi diskusi jawaban">
          Dosen ingin mendengar kamu menjelaskan jawabanmu sendiri: bagaimana kamu
          menyusunnya dan kenapa kamu sampai pada kesimpulan itu. Tidak perlu
          persiapan khusus selain memahami kembali jawabanmu.
        </Callout>
      ) : null}

      {classes.length === 0 ? (
        <Callout variant="info" title="Belum ada kelas">
          Kalender terisi setelah kamu bergabung ke kelas. Masukkan kode kelas dari
          dosenmu di Beranda.
        </Callout>
      ) : null}
    </div>
  );
}
