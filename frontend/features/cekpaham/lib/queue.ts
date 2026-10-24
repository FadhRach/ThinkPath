import type { CekPahamRow } from "@/lib/types";

/** Tiga angka ringkas di atas daftar Cek Paham dosen. */
export function queueStats(rows: CekPahamRow[]) {
  return {
    // Yang dibatalkan tidak lagi ditunggu.
    waiting: rows.filter((row) => row.status === "active" && row.attempt === null).length,
    scored: rows.filter((row) => row.attempt?.status === "scored").length,
    openReports: rows.reduce((total, row) => total + (row.attempt?.open_reports ?? 0), 0),
  };
}
