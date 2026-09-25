import { dayKey, formatDayHeading } from "@/lib/formatting";
import type { ScheduleItem } from "@/lib/types";

export interface AgendaDay {
  key: string;
  heading: string;
  items: ScheduleItem[];
}

/**
 * Kelompokkan agenda per hari pada zona tampilan. Masukan sudah terurut waktu
 * dari backend, jadi urutan hari dan urutan di dalam hari ikut terjaga.
 */
export function groupByDay(items: ScheduleItem[], now: Date = new Date()): AgendaDay[] {
  const days = new Map<string, AgendaDay>();
  for (const item of items) {
    const key = dayKey(item.at);
    const day = days.get(key) ?? { key, heading: formatDayHeading(item.at, now), items: [] };
    day.items.push(item);
    days.set(key, day);
  }
  return Array.from(days.values());
}

/**
 * Keadaan satu agenda dari sudut mahasiswa. "Terlewat" tidak dikirim backend
 * karena bergantung pada kapan halaman dibuka: tenggat yang lewat tanpa
 * jawaban tidak lagi bisa dikerjakan, jadi tampil redup, bukan mendesak.
 */
export type AgendaState =
  | "todo"
  | "missed"
  | "submitted"
  | "graded"
  | "session"
  | "session_done";

export function agendaState(item: ScheduleItem, now: Date): AgendaState {
  if (item.kind === "session") return item.status === "done" ? "session_done" : "session";
  if (item.status === "graded") return "graded";
  if (item.status === "submitted") return "submitted";
  return new Date(item.at).getTime() < now.getTime() ? "missed" : "todo";
}

interface AgendaStyle {
  label: string;
  /** Titik dan garis penanda warna. */
  mark: string;
  /** Latar kartu kecil di kalender. */
  chip: string;
  /** Warna teks label status. */
  text: string;
}

// Merah sengaja tidak dipakai. Tenggat terlewat tidak bisa diapa-apakan lagi,
// jadi cukup redup; kuning disisakan untuk yang masih bisa dikerjakan.
export const AGENDA_STYLE: Record<AgendaState, AgendaStyle> = {
  todo: {
    label: "Belum dikerjakan",
    mark: "bg-warning",
    chip: "bg-warning-soft text-foreground",
    text: "text-warning",
  },
  missed: {
    label: "Terlewat",
    mark: "bg-muted-foreground/40",
    chip: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  },
  submitted: {
    label: "Terkumpul",
    mark: "bg-brand-teal-light",
    chip: "bg-secondary/70 text-secondary-foreground",
    text: "text-primary",
  },
  graded: {
    label: "Dinilai",
    mark: "bg-success",
    chip: "bg-success-soft text-foreground",
    text: "text-success",
  },
  session: {
    label: "Dijadwalkan",
    mark: "bg-primary",
    chip: "bg-primary text-primary-foreground",
    text: "text-primary",
  },
  session_done: {
    label: "Sudah berlangsung",
    mark: "bg-muted-foreground/40",
    chip: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  },
};

const SESSION_PREFIX = /^Sesi diskusi jawaban:\s*/;

/** Judul ringkas untuk kotak kalender yang sempit; ikon sudah menandai sesinya. */
export function shortTitle(item: ScheduleItem): string {
  return item.kind === "session" ? item.title.replace(SESSION_PREFIX, "") : item.title;
}
