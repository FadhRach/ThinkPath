/** "done" hanya untuk Cek Paham yang sudah dikerjakan, tanpa hasilnya. */
export type ScheduleStatus = "not_submitted" | "submitted" | "graded" | "scheduled" | "done";

/** Satu baris agenda mahasiswa: tenggat tugas atau batas waktu Cek Paham. */
export interface ScheduleItem {
  id: string;
  kind: "deadline" | "cekpaham";
  at: string;
  title: string;
  class_id: string;
  class_name: string;
  status: ScheduleStatus;
  link: string;
}
