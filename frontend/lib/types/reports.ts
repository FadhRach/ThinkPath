import type { EducationLevel } from "./common";

/** Metrik yang sama dipakai tiap pengelompokan di laporan. */
export interface ReportGroupMetrics {
  analysed_count: number;
  below_target_count: number;
  /** Null kalau belum ada submission teranalisis, bukan nol. */
  below_target_ratio: number | null;
  high_band_count: number;
  avg_bloom: number | null;
}

export interface ReportClassRow extends ReportGroupMetrics {
  id: string;
  name: string;
  subject: string;
  education_level: EducationLevel;
  program_studi: string;
  semester: number | null;
  assignment_count: number;
}

export interface ReportProgramRow extends ReportGroupMetrics {
  program_studi: string;
}

export interface ReportSemesterRow extends ReportGroupMetrics {
  semester: number | null;
}

export interface ReportOverview {
  class_count: number;
  submission_count: number;
  analysed_count: number;
  cognitive_gap: { below: number; on_target: number; above: number };
  ai_band: { low: number; mid: number; high: number };
  /** Asal skor AI: detektor eksternal, sinyal teks (heuristik), model bahasa
   *  (hanya hasil versi lama), atau data demo. */
  provenance: { llm: number; detector: number; heuristic: number; seed: number };
}

export interface ReportPayload {
  overview: ReportOverview;
  per_class: ReportClassRow[];
  per_program: ReportProgramRow[];
  per_semester: ReportSemesterRow[];
}
