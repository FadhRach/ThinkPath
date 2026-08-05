export type Role = "teacher" | "student";
export type EducationLevel = "D3" | "S1" | "S2" | "S3";
export type AiBand = "low" | "mid" | "high";
export type Confidence = "low" | "medium" | "high" | "";
export type SubmissionStatus = "draft" | "submitted" | "reviewed";
export type EventType = "started" | "revision" | "paste" | "submitted";
export type AnalysisSource = "llm" | "heuristic" | "seed";

/** Kontribusi satu sinyal terhadap skor AI. Jumlah seluruh contribution
 *  sama dengan ai_score, sehingga skor bisa ditelusuri dosen. */
export interface SignalContribution {
  key: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
  evidence: string;
}

export interface AnalysisView {
  ai_score: number;
  ai_band: AiBand;
  bloom_level: number;
  /** Keyakinan terhadap skor AI. */
  confidence: Confidence;
  /** Keyakinan terhadap level Bloom. Dinilai terpisah karena satu teks bisa
   *  jelas di satu dimensi dan ambigu di dimensi lain. */
  bloom_confidence: Confidence;
  signals: string[];
  /** Kosong pada jalur LLM, karena rincian bobot hanya dimiliki heuristik. */
  signal_breakdown: SignalContribution[];
  summary: string;
  recommendation: string;
  analysis_source: AnalysisSource;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
  education_level: EducationLevel | "" | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  profile: Profile;
}

export interface ClassPublic {
  id: string;
  name: string;
  subject: string;
  education_level: EducationLevel;
  /** Prodi penyelenggara. Kosong untuk mata kuliah umum atau kelas lintas prodi. */
  program_studi: string;
  /** Semester penyelenggaraan kelas, bukan semester mahasiswa. */
  semester: number | null;
}

export interface StudentAssignment {
  id: string;
  title: string;
  instructions: string;
  deadline: string | null;
  expected_bloom_level: number;
  education_level: EducationLevel;
}

export interface StudentSubmissionStatus {
  id: string;
  status: SubmissionStatus;
  submitted_at: string | null;
  grade: number | null;
  teacher_feedback: string;
  text_answer: string;
  revision_count: number;
}

export interface StudentClassWithAssignments extends ClassPublic {
  teacher_name: string;
  joined_at: string;
  assignments: Array<
    StudentAssignment & { submission: StudentSubmissionStatus | null }
  >;
}

export interface StudentAssignmentDetail {
  class: ClassPublic;
  assignment: StudentAssignment;
  submission: StudentSubmissionStatus | null;
}

export interface JoinClassResult {
  class: ClassPublic;
  created: boolean;
}

export interface ClassSummary {
  id: string;
  name: string;
  subject: string;
  education_level: EducationLevel;
  program_studi: string;
  semester: number | null;
  join_code: string;
  assignment_count: number;
  created_at: string;
}

export interface AssignmentSummary {
  id: string;
  class_id: string;
  title: string;
  instructions: string;
  deadline: string | null;
  expected_bloom_level: number;
  education_level: EducationLevel;
  submission_count: number;
  high_band_count: number;
  needs_review_count: number;
  created_at: string;
}

export interface StudentMini {
  id: string;
  display_name: string;
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
  analysis: { ai_band: AiBand; bloom_level: number } | null;
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
    title: string;
    expected_bloom_level: number;
    /** Diwarisi dari kelas, tidak lagi disimpan di Assignment. */
    education_level: EducationLevel;
    program_studi: string;
    semester: number | null;
  };
  student: StudentMini;
  text_answer: string;
  started_at: string;
  submitted_at: string | null;
  duration_seconds: number | null;
  revision_count: number;
  status: SubmissionStatus;
  grade: number | null;
  teacher_feedback: string;
  reasoning_events: ReasoningEventView[];
  analysis: AnalysisView | null;
}
