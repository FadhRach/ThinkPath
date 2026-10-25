import type { CekPahamRow } from "@/lib/types";

export type BoardStatus = "perlu" | "belum" | "batal" | "semua";

export const BOARD_STATUS_LABEL: Record<BoardStatus, string> = {
  perlu: "Perlu ditinjau",
  belum: "Belum selesai",
  batal: "Dibatalkan",
  semua: "Semua",
};

/** Hasil siap, perlu diproses ulang, terputus, atau ada laporan mahasiswa yang menunggu. */
function needsReview(row: CekPahamRow): boolean {
  const attempt = row.attempt;
  if (row.status === "cancelled" || attempt === null) return false;
  return (
    attempt.open_reports > 0 ||
    attempt.status === "scored" ||
    attempt.status === "processing_failed" ||
    attempt.status === "interrupted"
  );
}

export function matchesBoardStatus(row: CekPahamRow, status: BoardStatus): boolean {
  if (status === "semua") return true;
  if (status === "batal") return row.status === "cancelled";
  if (status === "perlu") return needsReview(row);
  // Belum dikerjakan, atau sedang direkam / diproses.
  return (
    row.status === "active" &&
    (row.attempt === null ||
      row.attempt.status === "in_progress" ||
      row.attempt.status === "processing")
  );
}

export function filterBoard(
  rows: CekPahamRow[],
  { classId, query }: { classId: string; query: string },
): CekPahamRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (classId === "" || row.class_id === classId) &&
      (!needle ||
        row.student_name.toLowerCase().includes(needle) ||
        row.assignment_title.toLowerCase().includes(needle)),
  );
}
