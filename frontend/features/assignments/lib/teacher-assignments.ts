import type { TeacherAssignmentRow } from "@/lib/types";

export type AssignmentStatus = "semua" | "dibuka" | "lewat" | "periksa";
export type AssignmentSort = "tenggat" | "terbaru" | "judul";

export const ASSIGNMENT_SORT_LABEL: Record<AssignmentSort, string> = {
  tenggat: "Tenggat terdekat",
  terbaru: "Terbaru dibuat",
  judul: "Judul (A–Z)",
};

export const ALL = "semua";

export function isClosed(item: TeacherAssignmentRow, now: number): boolean {
  return item.deadline !== null && new Date(item.deadline).getTime() < now;
}

export function matchesAssignmentStatus(
  item: TeacherAssignmentRow,
  status: AssignmentStatus,
  now: number,
): boolean {
  if (status === "semua") return true;
  if (status === "dibuka") return !isClosed(item, now);
  if (status === "lewat") return isClosed(item, now);
  return item.needs_review_count > 0;
}

/** Tenggat terdekat dulu; yang sudah lewat menyusul, yang tanpa tenggat paling akhir. */
export function sortAssignments(
  items: TeacherAssignmentRow[],
  sort: AssignmentSort,
  now: number,
): TeacherAssignmentRow[] {
  const sorted = [...items];
  if (sort === "judul") return sorted.sort((a, b) => a.title.localeCompare(b.title, "id"));
  if (sort === "terbaru") return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const rank = (item: TeacherAssignmentRow) =>
    item.deadline === null ? 2 : isClosed(item, now) ? 1 : 0;
  return sorted.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) === 1
        ? (b.deadline ?? "").localeCompare(a.deadline ?? "")
        : (a.deadline ?? "").localeCompare(b.deadline ?? "")),
  );
}

export interface ClassGroup {
  classId: string;
  className: string;
  items: TeacherAssignmentRow[];
  waiting: number;
}

/** Kelompokkan per kelas; kelas dengan antrean periksa terbanyak di atas. */
export function groupByClass(items: TeacherAssignmentRow[]): ClassGroup[] {
  const groups = new Map<string, ClassGroup>();
  for (const item of items) {
    const group = groups.get(item.class_id) ?? {
      classId: item.class_id,
      className: item.class_name,
      items: [],
      waiting: 0,
    };
    group.items.push(item);
    group.waiting += item.needs_review_count;
    groups.set(item.class_id, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.waiting - a.waiting || a.className.localeCompare(b.className, "id"),
  );
}
