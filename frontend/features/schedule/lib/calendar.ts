import { dayKey, parseDateTimeInput } from "@/lib/formatting";
import type { ScheduleItem } from "@/lib/types";

/**
 * Hitungan kalender untuk halaman Jadwal.
 *
 * Hari dipegang sebagai kunci "YYYY-MM-DD" pada zona tampilan, bukan objek
 * Date. Menjumlah hari pada Date lokal ikut terpengaruh zona mesin yang
 * merender (server ber-UTC, laptop ber-WIB); di sini aritmetikanya lewat
 * Date.UTC, sehingga hasilnya sama di mana pun halaman dirender.
 */

export type CalendarView = "bulan" | "minggu";

/** Minggu lebih dulu, seperti kalender dinding dan Google Classroom berbahasa Indonesia. */
export const WEEKDAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Kunci tanggal dari parameter URL, atau null bila bukan tanggal yang ada. */
export function parseDayKey(raw: string | undefined): string | null {
  if (!raw || !DAY_KEY.test(raw)) return null;
  // Tahun di luar rentang ini tidak punya arti untuk jadwal kuliah, dan tahun
  // sangat besar membuat hitungan tanggal meluap melewati format YYYY-MM-DD.
  const year = Number(raw.slice(0, 4));
  if (year < 2000 || year > 2100) return null;
  const date = toUtc(raw);
  // 2026-02-30 lolos pola tetapi bergulir ke Maret; tanggal seperti itu ditolak.
  return Number.isNaN(date.getTime()) || fromUtc(date) !== raw ? null : raw;
}

export function addDays(key: string, days: number): string {
  const date = toUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

export function dayOfMonth(key: string): number {
  return Number(key.slice(8, 10));
}

function startOfWeek(key: string): string {
  return addDays(key, -toUtc(key).getUTCDay());
}

function startOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

function addMonths(key: string, months: number): string {
  const date = toUtc(startOfMonth(key));
  date.setUTCMonth(date.getUTCMonth() + months);
  return fromUtc(date);
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

function formatKey(key: string, options: Intl.DateTimeFormatOptions): string {
  // Tengah hari UTC, jadi tanggalnya tidak bergeser di zona mana pun.
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("id-ID", {
    ...options,
    timeZone: "UTC",
  });
}

/**
 * "20–26 September 2026", "27 Sep – 3 Okt 2026", atau lintas tahun. Versi
 * pendek memakai nama bulan singkat, untuk layar ponsel.
 */
function formatWeekLabel(first: string, last: string, short = false): string {
  if (isSameMonth(first, last)) {
    return `${dayOfMonth(first)}–${dayOfMonth(last)} ${formatKey(last, {
      month: short ? "short" : "long",
      year: "numeric",
    })}`;
  }
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const start = formatKey(first, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${start} – ${formatKey(last, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** "Jumat, 25 September". */
export function formatDayKeyLong(key: string): string {
  return formatKey(key, { weekday: "long", day: "numeric", month: "long" });
}

/** "September". */
export function formatMonthName(key: string): string {
  return formatKey(key, { month: "long" });
}

/** "Hari ini", "Besok", atau "Kemarin"; null untuk hari lain. */
export function relativeDayName(key: string, today: string): string | null {
  if (key === today) return "Hari ini";
  if (key === addDays(today, 1)) return "Besok";
  if (key === addDays(today, -1)) return "Kemarin";
  return null;
}

export interface CalendarRange {
  view: CalendarView;
  anchor: string;
  /** Hari pertama dan terakhir yang tampil, termasuk sisa pekan dari bulan lain. */
  first: string;
  last: string;
  days: string[];
  label: string;
  /** Label untuk layar sempit. */
  shortLabel: string;
  previous: string;
  next: string;
}

function daysBetween(first: string, last: string): string[] {
  const days: string[] = [];
  for (let key = first; key <= last; key = addDays(key, 1)) days.push(key);
  return days;
}

export function buildRange(view: CalendarView, anchor: string): CalendarRange {
  if (view === "minggu") {
    const first = startOfWeek(anchor);
    const last = addDays(first, 6);
    return {
      view,
      anchor,
      first,
      last,
      days: daysBetween(first, last),
      label: formatWeekLabel(first, last),
      shortLabel: formatWeekLabel(first, last, true),
      previous: addDays(anchor, -7),
      next: addDays(anchor, 7),
    };
  }
  // Pekan penuh saja, jadi jumlah barisnya 4 sampai 6 mengikuti bulannya.
  const first = startOfWeek(startOfMonth(anchor));
  const last = addDays(startOfWeek(addDays(addMonths(anchor, 1), -1)), 6);
  const label = formatKey(anchor, { month: "long", year: "numeric" });
  return {
    view,
    anchor,
    first,
    last,
    days: daysBetween(first, last),
    label,
    shortLabel: label,
    previous: addMonths(anchor, -1),
    next: addMonths(anchor, 1),
  };
}

/** Batas rentang untuk API: tengah malam di zona tampilan, dikirim sebagai UTC. */
export function rangeInstants(range: CalendarRange): { start: string; end: string } {
  return {
    start: parseDateTimeInput(`${range.first}T00:00`),
    end: parseDateTimeInput(`${addDays(range.last, 1)}T00:00`),
  };
}

/** Agenda per hari; urutan di dalam hari mengikuti urutan waktu dari backend. */
export function itemsByDay(items: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const days = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const key = dayKey(item.at);
    days.set(key, [...(days.get(key) ?? []), item]);
  }
  return days;
}

/** Nilai pilihan "Semua kelas" pada saringan kelas. */
export const ALL_CLASSES = "semua";

/** Alamat halaman Jadwal. Nilai bawaan tidak ditulis supaya tautannya pendek. */
export function jadwalHref(params: {
  view?: CalendarView;
  date?: string | null;
  kelas?: string | null;
}): string {
  const query = new URLSearchParams();
  if (params.view === "minggu") query.set("tampilan", "minggu");
  if (params.date) query.set("tanggal", params.date);
  if (params.kelas) query.set("kelas", params.kelas);
  const text = query.toString();
  return text ? `/student/jadwal?${text}` : "/student/jadwal";
}
