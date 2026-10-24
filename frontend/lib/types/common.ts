export type Role = "teacher" | "student";

export type EducationLevel = "D3" | "S1" | "S2" | "S3";

export type AiBand = "low" | "mid" | "high";

export type Confidence = "low" | "medium" | "high" | "";

export type SubmissionStatus = "draft" | "submitted" | "reviewed";

export type EventType = "started" | "revision" | "paste" | "submitted" | "progress";

export type AnalysisSource = "llm" | "detector" | "heuristic" | "seed";

/** Keadaan analisis sebuah pengumpulan; "pending"/"running" berarti worker belum selesai. */
export type AnalysisState = "pending" | "running" | "done" | "failed";

/** Pola pengerjaan: bukti tersendiri yang tidak menjumlah ke skor AI. Kosong untuk jawaban diimpor. */
export type ProcessBand = "normal" | "partial" | "attention" | "unrecorded" | "";

export interface StudentMini {
  id: string;
  display_name: string;
}
