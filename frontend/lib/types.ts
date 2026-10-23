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
/** Keadaan analisis sebuah pengumpulan; "pending"/"running" berarti worker belum selesai. */
export type AnalysisState = "pending" | "running" | "done" | "failed";
/** Pola pengerjaan: bukti tersendiri yang tidak menjumlah ke skor AI. Kosong untuk jawaban diimpor. */
export type ProcessBand = "normal" | "partial" | "attention" | "unrecorded" | "";
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
  /** Berapa dari count yang di bawah target tugasnya sendiri. Opsional karena
   *  frontend dan backend di-deploy terpisah; backend lama belum mengirimnya. */
  below_target?: number;
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
  process_band: ProcessBand;
  process_evidence: string;
}

/** Satu baris riwayat analisis; setiap analisis tersimpan permanen. */
export interface AnalysisRunView {
  id: string;
  trigger: "submit" | "revise" | "reanalyze";
  created_at: string;
  ai_score: number;
  ai_band: AiBand;
  bloom_level: number;
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
  profile: Profile;
}

export type ConsentState = "given" | "withdrawn" | "outdated" | "none";
export type ConsentActionKind = "given" | "updated" | "withdrawn";

export interface ConsentHistoryEntry {
  id: string;
  action: ConsentActionKind;
  policy_version: string;
  items: string[];
  /** Asal catatan: register, reaccept, withdraw, seed; kosong pada data lama. */
  source: string;
  created_at: string;
}

export interface DeletionImpact {
  role: Role;
  classes: number;
  submissions: number;
  files: number;
  /** Hanya dosen. */
  students?: number;
}

/** Keadaan persetujuan pemrosesan data pribadi beserta rekam jejaknya. */
export interface ConsentStatus {
  current_version: string;
  status: ConsentState;
  items: string[];
  given_at: string | null;
  history: ConsentHistoryEntry[];
}

/** Balasan saat persetujuan diberikan atau ditarik: token lama sudah usang. */
// Token tidak ada di sini: jembatan /bff memindahkannya ke cookie HttpOnly.
export interface ConsentChangeResponse {
  consent: ConsentStatus;
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
  /** Dosennya sudah menghapus akun: kelas hanya bisa dibaca. */
  is_archived: boolean;
  owner_left_at: string | null;
}

export interface StudentAssignment {
  id: string;
  title: string;
  instructions: string;
  deadline: string | null;
  expected_bloom_level: number;
  /** Dosen mengizinkan jawaban diisi dari berkas; bila false, wajib diketik. */
  allow_file_upload: boolean;
  education_level: EducationLevel;
}

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

export interface StudentClassWithAssignments extends ClassPublic {
  teacher_name: string | null;
  joined_at: string;
  assignments: Array<
    StudentAssignment & { submission: StudentSubmissionStatus | null }
  >;
}

/** Draf tersimpan di server; ada hanya setelah mahasiswa mulai menulis. */
export interface AnswerDraft {
  text_answer: string;
  document_id: string | null;
  saved_at: string;
}

export interface StudentAssignmentDetail {
  class: ClassPublic;
  assignment: StudentAssignment;
  submission: StudentSubmissionWithText | null;
  draft: AnswerDraft | null;
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
  allow_file_upload: boolean;
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
  analysis_state: AnalysisState;
  analysis: { ai_band: AiBand; bloom_level: number; process_band: ProcessBand } | null;
}

export interface TeacherSubmissionRow extends SubmissionRow {
  assignment_title: string;
  class_id: string;
  class_name: string;
}

export interface ClassRosterStudent extends StudentMini {
  joined_at: string;
  submission_count: number;
  reviewed_count: number;
}

export interface Announcement {
  id: string;
  class_id: string;
  author_name: string;
  title: string;
  body: string;
  created_at: string;
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

/** Materi yang dibagikan dosen ke satu kelas: judul, ringkasan, dan tautan. */
export interface Material {
  id: string;
  class_id: string;
  class_name: string;
  /** Topik atau pertemuan, misalnya "Pertemuan 3: Desain kualitatif". Kosong
   *  berarti materi umum seperti silabus. */
  topic: string;
  title: string;
  description: string;
  /** Kosong bila materinya berupa ringkasan tanpa tautan. */
  url: string;
  created_at: string;
}

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

export type NotificationKind =
  | "announcement_new"
  | "assignment_new"
  | "material_new"
  | "submission_graded"
  | "deadline_soon"
  | "cekpaham_new"
  | "cekpaham_resolved"
  | "cekpaham_result"
  | "submissions_new"
  | "students_joined";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  /** Waktu yang dibicarakan notifikasi, misalnya tenggat atau jadwal sesi. */
  event_at: string | null;
  count: number;
  created_at: string;
  read: boolean;
}

export interface NotificationInbox {
  unread_count: number;
  items: NotificationItem[];
}

// --- Cek Paham: tes lisan singkat yang diminta dosen ---------------------------

export type CekPahamLanguage = "id" | "en";
export type CekPahamPhase = "upcoming" | "open" | "closed" | "cancelled";
export type CekPahamAttemptStatus =
  | "in_progress"
  | "processing"
  | "scored"
  | "processing_failed"
  | "interrupted"
  | "voided";
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
export type CekPahamStudentState =
  | "in_progress"
  | "processing"
  | "done"
  | "failed"
  | "interrupted";

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
  client_events: Partial<Record<
    "visibility_changes" | "blur_count" | "device_changes" | "mic_errors" | "silent_seconds",
    number
  > & { ended_reason: string }>;
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
