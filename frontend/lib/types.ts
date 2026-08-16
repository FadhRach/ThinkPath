export type Role = "teacher" | "student";
export type EducationLevel = "D3" | "S1" | "S2" | "S3";
export type AiBand = "low" | "mid" | "high";
export type Confidence = "low" | "medium" | "high" | "";
export type SubmissionStatus = "draft" | "submitted" | "reviewed";
export type EventType =
  | "started"
  | "revision"
  | "paste"
  | "submitted"
  | "progress";
export type AnalysisSource = "llm" | "detector" | "heuristic" | "seed";
export type VerificationStatus = "scheduled" | "completed" | "cancelled";
/** Baris pada halaman Daftar Tugas dosen: sama seperti AssignmentSummary,
 *  ditambah asal kelasnya karena di sana tugas lintas kelas bercampur. */
export interface TeacherAssignmentRow extends AssignmentSummary {
  class_name: string;
  subject: string;
}

export type TrendDirection = "naik" | "datar" | "turun" | "belum_cukup_data";

export interface CognitivePoint {
  submission_id: string;
  label: string;
  level: number;
  expected: number;
  /** Tidak dikirim ke mahasiswa: dia melihat perkembangannya, bukan dugaan sistem. */
  ai_band?: AiBand;
  submitted_at: string;
}

export interface CognitiveClassSeries {
  class_id: string;
  class_name: string;
  subject: string;
  /** Rata rata bergerak eksponensial, bukan rata rata biasa. */
  current_level: number | null;
  direction: TrendDirection;
  point_count: number;
  average_target: number | null;
  points: CognitivePoint[];
}

export interface CognitiveProfile {
  student: StudentMini;
  classes: CognitiveClassSeries[];
}

export interface OverviewStudent {
  student_id: string;
  display_name: string;
  /** Rata rata skor AI lintas submission, bukan nilai tertinggi. */
  ai_mean: number;
  high_count: number;
  current_level: number | null;
  average_target: number | null;
  /** current_level dikurangi average_target. Negatif berarti tertinggal. */
  gap: number | null;
  direction: TrendDirection;
  submission_count: number;
}

export interface BloomDistributionBin {
  level: number;
  count: number;
}

export interface CohortTrendPoint {
  label: string;
  title: string;
  level: number;
  expected: number;
}

export interface OverviewClass {
  class_id: string;
  class_name: string;
  subject: string;
  students: OverviewStudent[];
  below_target_count: number;
  high_band_count: number;
  bloom_distribution: BloomDistributionBin[];
  cohort_trend: CohortTrendPoint[];
  /** Rata rata target lintas tugas kelas, bukan lintas mahasiswa. */
  average_target: number | null;
}

export interface TeacherOverview {
  classes: OverviewClass[];
}

export interface OwnProgress {
  classes: CognitiveClassSeries[];
}
/** Sengaja tidak ada nilai yang berarti "terbukti menyontek". Yang dinilai
 *  adalah apakah mahasiswa mampu menjelaskan kembali karyanya. */
export type VerificationOutcome =
  | "can_explain"
  | "partial"
  | "cannot_explain"
  | "inconclusive"
  | "";

export interface VerificationView {
  status: VerificationStatus;
  scheduled_at: string | null;
  outcome: VerificationOutcome;
  notes: string;
  completed_at: string | null;
  updated_at: string;
}

export interface VerificationQueueRow {
  submission_id: string;
  student_name: string;
  assignment_title: string;
  class_name: string;
  ai_band: AiBand | "";
  status: VerificationStatus;
  scheduled_at: string | null;
  outcome: VerificationOutcome;
  completed_at: string | null;
}

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
  /** Berapa banyak angka berasal dari detektor eksternal, analisis penuh,
   *  cadangan, atau data demo. */
  provenance: { llm: number; detector: number; heuristic: number; seed: number };
}

export interface ReportPayload {
  overview: ReportOverview;
  per_class: ReportClassRow[];
  per_program: ReportProgramRow[];
  per_semester: ReportSemesterRow[];
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
  verification: VerificationView | null;
}
