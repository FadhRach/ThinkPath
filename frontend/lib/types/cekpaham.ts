export type CekPahamLanguage = "id" | "en";

export type CekPahamPhase = "upcoming" | "open" | "closed" | "cancelled";

export type CekPahamAttemptStatus =
  "in_progress" | "processing" | "scored" | "processing_failed" | "interrupted" | "voided";

export type CekPahamReportReason = "transcript_mismatch" | "mic_failure" | "other";

export type CekPahamReportStatus = "open" | "dismissed" | "retry_granted";

export type CekPahamBand = "kuat" | "sebagian" | "lemah" | "";

/** Keadaan persetujuan untuk mengerjakan Cek Paham, dibaca server dari basis data. */
export interface CekPahamConsent {
  policy_current: boolean;
  voice: boolean;
  external_ai: boolean;
  ready: boolean;
}

/** Keadaan sesi menurut mahasiswa. Sengaja tanpa kata "dinilai" atau skor. */
export type CekPahamStudentState = "in_progress" | "processing" | "done" | "failed" | "interrupted";

export interface CekPahamStudentReport {
  reason: CekPahamReportReason;
  status: CekPahamReportStatus;
  created_at: string;
  response_note: string;
}

/** Yang boleh dilihat mahasiswa: tanpa soal (hanya dari start), skor, atau flag. */
export interface StudentCekPaham {
  id: string;
  assignment_title: string;
  class_name: string;
  language: CekPahamLanguage;
  answer_seconds: number;
  window_start: string;
  window_end: string;
  phase: CekPahamPhase;
  consent: CekPahamConsent;
  attempt: {
    number: number;
    state: CekPahamStudentState;
    /** Transkrip jawabannya sendiri, dari server. */
    transcript: string;
    can_report: boolean;
    reports: CekPahamStudentReport[];
  } | null;
}

export interface CekPahamStart {
  question_text: string;
  number: number;
  deadline_at: string;
  server_now: string;
  answer_seconds: number;
}

export interface CekPahamLiveResult {
  ok: boolean;
  text: string;
  error: string;
}

export interface CekPahamFinalizeResult {
  state: CekPahamStudentState;
  transcript: string;
}

export interface CekPahamDimension {
  level: number;
  evidence: string[];
  reason: string;
}

export interface CekPahamReportView {
  id: string;
  reason: CekPahamReportReason;
  note: string;
  status: CekPahamReportStatus;
  created_at: string;
  resolved_at: string | null;
  response_note: string;
}

export interface CekPahamAttemptView {
  id: string;
  number: number;
  status: CekPahamAttemptStatus;
  started_at: string;
  deadline_at: string;
  finalized_at: string | null;
  audio_available: boolean;
  audio_duration_s: number | null;
  first_speech_offset_s: number | null;
  live_transcript: string;
  final_transcript: string;
  asr_model: string;
  asr_quality: {
    segments?: { text: string; avg_logprob: number | null }[];
    dropped?: { text: string; reason: string }[];
    unsure?: string[];
  };
  client_events: Partial<
    Record<
      "visibility_changes" | "blur_count" | "device_changes" | "mic_errors" | "silent_seconds",
      number
    > & { ended_reason: string }
  >;
  ai_score: number | null;
  ai_band: CekPahamBand;
  ai_dimensions: Record<string, CekPahamDimension>;
  ai_flags: string[];
  ai_summary: string;
  judge_model: string;
  rubric_version: string;
  judge_runs: { order: string; score: number }[];
  error_code: string;
  reports: CekPahamReportView[];
}

/** Satu baris daftar/antrean dosen. */
export interface CekPahamRow {
  id: string;
  submission_id: string;
  student_name: string;
  assignment_title: string;
  class_name: string;
  question_text: string;
  language: CekPahamLanguage;
  answer_seconds: number;
  window_start: string;
  window_end: string;
  status: "active" | "cancelled";
  phase: CekPahamPhase;
  created_at: string;
  cancelled_at: string | null;
  attempt: {
    number: number;
    status: CekPahamAttemptStatus;
    ai_score: number | null;
    ai_band: CekPahamBand;
    finalized_at: string | null;
    open_reports: number;
  } | null;
}

export interface CekPahamDetail extends CekPahamRow {
  keyterms: string[];
  attempts: CekPahamAttemptView[];
  student_consent_ready: boolean;
  /** Ambang band belum dikalibrasi; UI wajib memberi label. */
  calibrated: boolean;
}
