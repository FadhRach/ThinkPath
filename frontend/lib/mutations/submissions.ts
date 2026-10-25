import { apiFetchBrowser } from "@/lib/api/browser";
import { resolveJson } from "@/lib/api/request";
import { directFetch } from "@/lib/api/direct";
import type {
  AnalysisState,
  RichDoc,
  SubmissionComparison,
  SubmissionDetail,
  SubmissionSuggestion,
} from "@/lib/types";

export interface SubmitAnswerInput {
  /** Dokumen editor. Server menurunkan teks polosnya sendiri, jadi `text_answer` hanya cadangan. */
  rich_answer?: RichDoc;
  text_answer?: string;
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
export async function uploadDocument(assignmentId: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  // Langsung ke API dengan tiket: 10 MB melewati batas badan fungsi Vercel.
  return resolveJson<DocumentImportResult>(
    await directFetch(`/api/assignments/${assignmentId}/documents`, { method: "POST", body }),
  );
}

/**
 * Simpan draf. Server yang mencatat kapan pengerjaan dimulai dan menghitung
 * kata dari teksnya; klien tidak mengirim waktu maupun jumlah kata.
 */
export function saveDraft(
  assignmentId: string,
  input: { rich_answer?: RichDoc; text_answer?: string; document_id?: string | null },
  /** Biarkan permintaan selesai walau halaman ditutup (batas badan 64 KB oleh peramban). */
  keepalive = false,
) {
  return apiFetchBrowser<{ started: boolean; saved_at: string | null }>(
    `/api/assignments/${assignmentId}/draft`,
    { method: "PUT", body: JSON.stringify(input), keepalive },
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

/** Hanya mengantrekan; hasilnya dikerjakan worker (balasan 202). */
export function reanalyzeSubmission(submissionId: string) {
  return apiFetchBrowser<{ analysis_state: AnalysisState }>(
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

/** Saran untuk dosen atas satu jawaban. Hanya dijalankan saat dosen menekan tombolnya. */
export function requestSuggestion(submissionId: string) {
  return apiFetchBrowser<SubmissionSuggestion>(`/api/submissions/${submissionId}/suggestion`, {
    method: "POST",
  });
}

/** Dua jawaban pada tugas yang sama berdampingan; dibuka dosen dari kartu kemiripan. */
export function getSubmissionComparison(submissionId: string, otherId: string) {
  return apiFetchBrowser<SubmissionComparison>(
    `/api/submissions/${submissionId}/compare/${otherId}`,
  );
}
