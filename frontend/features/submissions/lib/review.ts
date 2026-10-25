import type { TeacherAssignmentRow, TeacherSubmissionRow } from "@/lib/types";

export type ReviewStatus = "perlu" | "semua" | "dinilai" | "perhatian";
export type ReviewSort = "terlama" | "terbaru" | "nama" | "level" | "ai";

export const SORT_LABEL: Record<ReviewSort, string> = {
  terlama: "Menunggu paling lama",
  terbaru: "Dikumpulkan terbaru",
  nama: "Nama mahasiswa (A–Z)",
  level: "Level paling jauh di bawah target",
  ai: "Indikasi AI tertinggi",
};

export interface ReviewFilters {
  classId: string;
  assignmentId: string;
  status: ReviewStatus;
  query: string;
}

export const ALL = "semua";

// Bukan daftar tersangka: skor AI tinggi ATAU pola pengerjaan yang perlu dilihat, dua bukti
// terpisah yang sama-sama layak ditinjau bersama konteks dosen.
function needsAttention(row: TeacherSubmissionRow): boolean {
  return row.analysis?.ai_band === "high" || row.analysis?.process_band === "attention";
}

export function matchesStatus(row: TeacherSubmissionRow, status: ReviewStatus): boolean {
  if (status === "semua") return true;
  if (status === "perlu") return row.status === "submitted";
  if (status === "dinilai") return row.status === "reviewed";
  return needsAttention(row);
}

/** Saring menurut kelas, tugas, status, dan nama mahasiswa. */
export function filterReviewRows(
  rows: TeacherSubmissionRow[],
  { classId, assignmentId, status, query }: ReviewFilters,
): TeacherSubmissionRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (classId === ALL || row.class_id === classId) &&
      (assignmentId === ALL || row.assignment_id === assignmentId) &&
      matchesStatus(row, status) &&
      (!needle || row.student.display_name.toLowerCase().includes(needle)),
  );
}

const AI_RANK = { high: 3, mid: 2, low: 1 } as const;

/** Selisih level hasil terhadap target; negatif berarti di bawah target. Null bila belum dianalisis. */
export function levelGap(row: TeacherSubmissionRow, target: number): number | null {
  return row.analysis ? row.analysis.bloom_level - target : null;
}

export function sortReviewRows(
  rows: TeacherSubmissionRow[],
  sort: ReviewSort,
  targets: Map<string, number>,
): TeacherSubmissionRow[] {
  const at = (row: TeacherSubmissionRow) => row.submitted_at ?? "";
  const gap = (row: TeacherSubmissionRow) =>
    levelGap(row, targets.get(row.assignment_id) ?? 0) ?? Number.POSITIVE_INFINITY;
  const ai = (row: TeacherSubmissionRow) => (row.analysis ? AI_RANK[row.analysis.ai_band] : 0);
  const sorted = [...rows];
  switch (sort) {
    case "terlama":
      return sorted.sort((a, b) => at(a).localeCompare(at(b)));
    case "terbaru":
      return sorted.sort((a, b) => at(b).localeCompare(at(a)));
    case "nama":
      return sorted.sort((a, b) =>
        a.student.display_name.localeCompare(b.student.display_name, "id"),
      );
    case "level":
      return sorted.sort((a, b) => gap(a) - gap(b));
    case "ai":
      return sorted.sort((a, b) => ai(b) - ai(a));
  }
}

export interface ReviewGroup {
  assignment: TeacherAssignmentRow;
  rows: TeacherSubmissionRow[];
  waiting: number;
}

/**
 * Kelompokkan per tugas: dosen memeriksa satu tugas sampai tuntas. Tugas dengan antrean paling
 * banyak di atas; yang sama banyak, tenggat terdekat dulu.
 */
export function groupByAssignment(
  rows: TeacherSubmissionRow[],
  assignments: TeacherAssignmentRow[],
): ReviewGroup[] {
  const byId = new Map(assignments.map((item) => [item.id, item]));
  const groups = new Map<string, ReviewGroup>();
  for (const row of rows) {
    const assignment = byId.get(row.assignment_id);
    if (!assignment) continue;
    const group = groups.get(assignment.id) ?? { assignment, rows: [], waiting: 0 };
    group.rows.push(row);
    if (row.status === "submitted") group.waiting += 1;
    groups.set(assignment.id, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.waiting - a.waiting ||
      (a.assignment.deadline ?? "9999").localeCompare(b.assignment.deadline ?? "9999"),
  );
}
