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
}

export interface StudentSubmissionWithText extends StudentSubmissionStatus {
  text_answer: string;
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

export interface SubmissionDetail {
  id: string;
  assignment: {
    id: string;
    /** Opsional: backend lama belum mengirimnya. */
    class_id?: string;
    title: string;
    expected_bloom_level: number;
    /** Diwarisi dari kelas, tidak lagi disimpan di Assignment. */
    education_level: EducationLevel;
    program_studi: string;
    semester: number | null;
  };
  student: StudentMini;
  text_answer: string;
  /** Jawaban berasal dari dokumen unggahan, jadi tanpa jejak mengetik. */
  is_imported: boolean;
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
}
