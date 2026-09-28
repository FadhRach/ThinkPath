import { apiFetchBrowser } from "./api-browser";
import { setAuthTokenCookie } from "./auth-token";
import { PRIVACY_POLICY_VERSION, type ConsentItemKey } from "./privacy";
import type {
  AnalysisView,
  AssignmentSummary,
  ClassSummary,
  ConsentChangeResponse,
  ConsentStatus,
  EducationLevel,
  JoinClassResult,
  Material,
  NotificationInbox,
  Profile,
  SubmissionDetail,
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

export interface SubmitAnswerInput {
  text_answer: string;
  started_at: string;
  progress?: ProgressSample[];
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

export interface MaterialInput {
  title: string;
  topic: string;
  description: string;
  url: string;
}

export function createMaterial(classId: string, input: MaterialInput) {
  return apiFetchBrowser<Material>(`/api/classes/${classId}/materials`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Mengubah materi tidak mengirim notifikasi ulang ke mahasiswa. */
export function updateMaterial(materialId: string, input: MaterialInput) {
  return apiFetchBrowser<Material>(`/api/materials/${materialId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMaterial(materialId: string) {
  return apiFetchBrowser<void>(`/api/materials/${materialId}`, { method: "DELETE" });
}

/**
 * Memberi persetujuan untuk versi kebijakan yang dibaca pengguna. Token baru
 * langsung disimpan karena klaim persetujuan di token lama sudah usang, dan
 * layout membaca klaim itu untuk memutuskan perlu tidaknya layar persetujuan.
 */
export async function giveConsent(items: ConsentItemKey[]) {
  const result = await apiFetchBrowser<ConsentChangeResponse>("/api/me/consent", {
    method: "POST",
    body: JSON.stringify({ policy_version: PRIVACY_POLICY_VERSION, items }),
  });
  setAuthTokenCookie(result.token);
  return result.consent;
}

/** Mengubah izin analisis oleh penyedia di luar negeri (mahasiswa). */
export async function setExternalAnalysis(allowed: boolean) {
  const result = await apiFetchBrowser<{ consent: ConsentStatus }>("/api/me/consent", {
    method: "PATCH",
    body: JSON.stringify({ external_ai: allowed }),
  });
  return result.consent;
}

/** Menarik persetujuan. Pemrosesan baru berhenti seketika di server. */
export async function withdrawConsent() {
  const result = await apiFetchBrowser<ConsentChangeResponse>("/api/me/consent/withdraw", {
    method: "POST",
  });
  setAuthTokenCookie(result.token);
  return result.consent;
}

export function fetchNotifications() {
  return apiFetchBrowser<NotificationInbox>("/api/notifications");
}

/** Tanpa ids berarti seluruh notifikasi ditandai dibaca. */
export function markNotificationsRead(ids?: string[]) {
  return apiFetchBrowser<{ unread_count: number }>("/api/notifications/read", {
    method: "POST",
    body: JSON.stringify(ids ? { ids } : {}),
  });
}
