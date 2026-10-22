import { apiFetchBrowser } from "./api-browser";
import { setAuthTokenCookie } from "./auth-token";
import { PRIVACY_POLICY_VERSION, type ConsentItemKey } from "./privacy";
import type {
  Announcement,
  AnalysisView,
  AssignmentSummary,
  CekPahamDetail,
  CekPahamFinalizeResult,
  CekPahamLanguage,
  CekPahamLiveResult,
  CekPahamReportReason,
  CekPahamStart,
  ClassSummary,
  ConsentChangeResponse,
  ConsentStatus,
  EducationLevel,
  JoinClassResult,
  Material,
  NotificationInbox,
  Profile,
  StudentCekPaham,
  SubmissionDetail,
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
  allow_file_upload: boolean;
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

export function updateAssignment(assignmentId: string, input: CreateAssignmentInput) {
  return apiFetchBrowser<AssignmentSummary>(`/api/assignments/${assignmentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function createAnnouncement(classId: string, input: { title: string; body: string }) {
  return apiFetchBrowser<Announcement>(`/api/classes/${classId}/announcements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
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
  /** Hasil uploadDocument; backend memeriksa teks memang berasal dari dokumen itu. */
  document_id?: string;
}

/** Cara teks dokumen dibaca: di server, oleh model visual (OCR), atau campuran. */
export type DocumentReadMethod = "text" | "ocr" | "mixed";

export interface DocumentImportResult {
  document_id: string;
  text: string;
  page_count: number;
  method: DocumentReadMethod;
  warnings: string[];
}

/** Unggah PDF/DOCX/gambar; membalas teks untuk ditinjau, belum mengumpulkan jawaban. */
export function uploadDocument(assignmentId: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiFetchBrowser<DocumentImportResult>(
    `/api/assignments/${assignmentId}/documents`,
    { method: "POST", body },
  );
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

/** Mengubah izin rekaman suara Cek Paham (mahasiswa). */
export async function setVoiceRecording(allowed: boolean) {
  const result = await apiFetchBrowser<{ consent: ConsentStatus }>("/api/me/consent", {
    method: "PATCH",
    body: JSON.stringify({ voice_cekpaham: allowed }),
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

// --- Cek Paham -----------------------------------------------------------------

export interface CreateCekPahamInput {
  question_text: string;
  language: CekPahamLanguage;
  answer_seconds: number;
  /** ISO 8601 (UTC). */
  window_start: string;
  window_end: string;
}

export function createCekPaham(submissionId: string, input: CreateCekPahamInput) {
  return apiFetchBrowser<CekPahamDetail>(`/api/submissions/${submissionId}/cekpaham`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function cancelCekPaham(id: string) {
  return apiFetchBrowser<CekPahamDetail>(`/api/cekpaham/${id}/cancel`, { method: "POST" });
}

export function reprocessCekPaham(id: string, attemptNumber: number) {
  return apiFetchBrowser<CekPahamDetail>(
    `/api/cekpaham/${id}/attempts/${attemptNumber}/reprocess`,
    { method: "POST" },
  );
}

export interface ResolveCekPahamReportInput {
  resolution: "dismissed" | "grant_retry";
  response_note: string;
  /** ISO 8601; kosong berarti jendela diperpanjang otomatis bila perlu. */
  extend_window_to?: string | null;
}

export function resolveCekPahamReport(reportId: string, input: ResolveCekPahamReportInput) {
  return apiFetchBrowser<CekPahamDetail>(`/api/cekpaham/reports/${reportId}/resolve`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startCekPaham(id: string) {
  return apiFetchBrowser<CekPahamStart>(`/api/student/cekpaham/${id}/start`, { method: "POST" });
}

/** Satu potongan audio untuk caption sementara. Gagal bukan galat: pemanggil cukup berhenti menampilkan caption. */
export function transcribeCekPahamChunk(id: string, audio: Blob, purpose: "mic_test" | "answer") {
  const body = new FormData();
  body.append("audio", audio, "potongan");
  body.append("purpose", purpose);
  return apiFetchBrowser<CekPahamLiveResult>(`/api/student/cekpaham/${id}/live`, {
    method: "POST",
    body,
  });
}

export interface FinalizeCekPahamInput {
  /** Kosong bila sesi terputus sebelum ada audio. */
  audio: Blob | null;
  liveTranscript: string;
  clientEvents: Record<string, number | string>;
  interrupted: boolean;
}

export function finalizeCekPaham(id: string, input: FinalizeCekPahamInput) {
  const body = new FormData();
  if (input.audio) body.append("audio", input.audio, "jawaban");
  body.append("live_transcript", input.liveTranscript);
  body.append("client_events", JSON.stringify(input.clientEvents));
  body.append("interrupted", input.interrupted ? "true" : "false");
  return apiFetchBrowser<CekPahamFinalizeResult>(`/api/student/cekpaham/${id}/finalize`, {
    method: "POST",
    body,
  });
}

export function reportCekPaham(id: string, input: { reason?: CekPahamReportReason; note: string }) {
  return apiFetchBrowser<StudentCekPaham>(`/api/student/cekpaham/${id}/report`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
