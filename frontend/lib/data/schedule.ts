import { apiFetch } from "@/lib/api/server";
import type { ScheduleItem } from "@/lib/types";

/**
 * Tanpa rentang: agenda yang akan datang (kartu beranda). Dengan rentang:
 * seluruh agenda di antara dua titik waktu, termasuk yang sudah lewat, untuk
 * tampilan kalender.
 */
export function getStudentSchedule(range?: { start: string; end: string }) {
  const query = range
    ? `?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`
    : "";
  return apiFetch<ScheduleItem[]>(`/api/student/schedule${query}`);
}
