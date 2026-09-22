import { apiFetchBrowser } from "./api-browser";
import type {
  AnalysisView,
  AssignmentSummary,
  ClassSummary,
  EducationLevel,
  ImportMetadata,
  JoinClassResult,
  Profile,
  SubmissionDetail,
  SubmissionOrigin,
  VerificationOutcome,
  VerificationStatus,
  VerificationView,
} from "./types";

export interface CreateClassInput {
  name: string;
  subject: string;
  education_level: EducationLevel;
  program_studi: string;
  semester: number | null;
}

/** Jenjang tidak dikirim: tugas mewarisinya dari kelas. */
export interface CreateAssignmentInput {
  title: string;
  instructions: string;
  deadline: string;
  expected_bloom_level: number;
}

export function createClass(input: CreateClassInput) {
  return apiFetchBrowser<ClassSummary>("/api/classes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createAssignment(classId: string, input: CreateAssignmentInput) {
  return apiFetchBrowser<AssignmentSummary>(
    `/api/classes/${classId}/assignments`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

/** Satu cuplikan jumlah kata pada satu titik waktu selama pengerjaan. */
export interface ProgressSample {
  at: string;
  word_count: number;
}

/** Satu peristiwa tempel: kapan terjadi dan berapa karakter yang masuk. */
export interface PasteEvent {
  at: string;
  char_count: number;
}

export interface SubmitAnswerInput {
  text_answer: string;
  rich_content?: unknown;
  started_at: string;
  progress?: ProgressSample[];
  paste_events?: PasteEvent[];
  origin?: SubmissionOrigin;
  import_metadata?: ImportMetadata | null;
}

export function submitAnswer(assignmentId: string, input: SubmitAnswerInput) {
  return apiFetchBrowser<{ id: string; detail: string }>(
    `/api/assignments/${assignmentId}/submissions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export interface ExtractDocumentInput {
  blob_url: string;
  content_type: string;
  filename: string;
}

export interface ExtractDocumentResult {
  text: string;
  page_count: number;
  extraction_method: ImportMetadata["extraction_method"];
  warnings: string[];
}

export function extractDocument(assignmentId: string, input: ExtractDocumentInput) {
  return apiFetchBrowser<ExtractDocumentResult>(
    `/api/assignments/${assignmentId}/extract-document`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function joinClass(joinCode: string) {
  return apiFetchBrowser<JoinClassResult>("/api/join", {
    method: "POST",
    body: JSON.stringify({ join_code: joinCode }),
  });
}

export function reanalyzeSubmission(submissionId: string) {
  return apiFetchBrowser<{ analysis: AnalysisView }>(
    `/api/submissions/${submissionId}/reanalyze`,
    { method: "POST" },
  );
}

export interface GradeInput {
  grade: number;
  teacher_feedback: string;
}

export function gradeSubmission(submissionId: string, input: GradeInput) {
  return apiFetchBrowser<SubmissionDetail>(`/api/submissions/${submissionId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface SaveVerificationInput {
  status: VerificationStatus;
  scheduled_at?: string | null;
  outcome?: VerificationOutcome;
  notes?: string;
}

export function saveVerification(
  submissionId: string,
  input: SaveVerificationInput,
) {
  return apiFetchBrowser<VerificationView>(
    `/api/submissions/${submissionId}/verification`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export function cancelVerification(submissionId: string) {
  return apiFetchBrowser<void>(
    `/api/submissions/${submissionId}/verification`,
    { method: "DELETE" },
  );
}

export interface UpdateProfileInput {
  display_name?: string;
  education_level?: EducationLevel;
}

/** Email dan peran sengaja tidak bisa diubah dari sini: keduanya menjadi dasar
 *  kepemilikan kelas dan submission yang sudah tersimpan. */
export function updateProfile(input: UpdateProfileInput) {
  return apiFetchBrowser<Profile>("/api/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
