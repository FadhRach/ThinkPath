import type { AnalysisRunView, AnalysisView } from "./analysis";
import type {
  AiBand,
  AnalysisState,
  EducationLevel,
  EventType,
  ProcessBand,
  StudentMini,
  SubmissionStatus,
} from "./common";

// Varian listing dari backend sengaja tanpa text_answer supaya daftar kelas
// tidak ikut mengangkut seluruh esai; teks lengkap hanya ada di endpoint
// detail tugas (StudentSubmissionWithText).
export interface StudentSubmissionStatus {
  id: string;
  status: SubmissionStatus;
  submitted_at: string | null;
  grade: number | null;
  teacher_feedback: string;
  revision_count: number;
  /** Jawaban berasal dari berkas unggahan; berkas aslinya bisa dibuka kembali. */
  is_imported: boolean;
  /** Berkas yang terlampir pada jawaban ini (milik mahasiswa sendiri), null bila diketik. */
  document_id: string | null;
}

/** Dokumen editor kaya (TipTap/ProseMirror JSON) yang sudah dibersihkan server. */
export interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export interface RichDoc extends RichNode {
  type: "doc";
}

export interface StudentSubmissionWithText extends StudentSubmissionStatus {
  text_answer: string;
  /** Null untuk jawaban teks polos (lama). */
  rich_answer: RichDoc | null;
}

export interface SubmissionRow {
  id: string;
  assignment_id: string;
  student: StudentMini;
  submitted_at: string | null;
  duration_seconds: number | null;
  revision_count: number;
  status: SubmissionStatus;
  grade: number | null;
  analysis_state: AnalysisState;
  analysis: { ai_band: AiBand; bloom_level: number; process_band: ProcessBand } | null;
}

export interface TeacherSubmissionRow extends SubmissionRow {
  assignment_title: string;
  class_id: string;
  class_name: string;
}

export interface ReasoningEventView {
  event_type: EventType;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface StyleMarker {
  key: string;
  /** strong: sisa salinan obrolan; weak: kebiasaan gaya yang juga dipakai penulis manusia. */
  tier: "strong" | "weak";
  label: string;
  hint: string;
  count: number;
  examples: string[];
}

export interface StyleMarkerSpan {
  start: number;
  end: number;
  key: string;
  tier: "strong" | "weak";
}

export interface StyleMarkers {
  markers: StyleMarker[];
  /** Indeks karakter pada `text_answer` yang sama persis. */
  spans: StyleMarkerSpan[];
  strong_total: number;
}

export interface SimilarSubmission {
  submission_id: string;
  student_name: string;
  /** 0-1, Jaccard potongan lima kata. */
  score: number;
}

export interface ComparisonSide {
  submission_id: string;
  student_name: string;
  text: string;
  /** Rentang karakter pada `text` yang potongannya sama dengan jawaban pembanding. */
  spans: { start: number; end: number }[];
}

export interface SubmissionComparison {
  score: number;
  a: ComparisonSide;
  b: ComparisonSide;
}

export type SuggestionVerdict = "baik" | "tinjau" | "cekpaham" | "bandingkan";

export interface SubmissionSuggestion {
  verdict: SuggestionVerdict;
  headline: string;
  points: string[];
  next_steps: string[];
  caveats: string[];
  similar: SimilarSubmission[];
  class_context: { graded: number; average_grade: number | null; average_level: number | null };
  /** Narasi Groq; null bila tidak diizinkan, tidak dikonfigurasi, atau gagal. */
  narrative: {
    ringkasan: string;
    kekuatan: string[];
    kekurangan: string[];
    draf_umpan_balik: string;
  } | null;
  narrative_skipped?: string;
  source: "aturan" | "aturan+groq";
}

export interface SubmissionDetail {
  id: string;
  assignment: {
    id: string;
    /** Opsional: backend lama belum mengirimnya. */
    class_id?: string;
    title: string;
    instructions: string;
    instructions_rich: RichDoc | null;
    expected_bloom_level: number;
    /** Diwarisi dari kelas, tidak lagi disimpan di Assignment. */
    education_level: EducationLevel;
    program_studi: string;
    semester: number | null;
  };
  student: StudentMini;
  text_answer: string;
  rich_answer: RichDoc | null;
  /** Jawaban berasal dari dokumen unggahan, jadi tanpa jejak mengetik. */
  is_imported: boolean;
  /** Berkas asli masih ada di server; false bila hilang (teks hasil baca tetap tersimpan). */
  document_available: boolean;
  started_at: string;
  submitted_at: string | null;
  duration_seconds: number | null;
  revision_count: number;
  status: SubmissionStatus;
  grade: number | null;
  teacher_feedback: string;
  reasoning_events: ReasoningEventView[];
  analysis_state: AnalysisState;
  analysis: AnalysisView | null;
  /** Terbaru dulu. */
  analysis_history: AnalysisRunView[];
  style_markers: StyleMarkers;
  similar_submissions: SimilarSubmission[];
}
