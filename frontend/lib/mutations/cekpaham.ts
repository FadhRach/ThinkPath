import { apiFetchBrowser } from "@/lib/api/browser";
import { resolveJson } from "@/lib/api/request";
import { directFetch } from "@/lib/api/direct";
import type {
  CekPahamDetail,
  CekPahamFinalizeResult,
  CekPahamLanguage,
  CekPahamLiveResult,
  CekPahamReportReason,
  CekPahamStart,
  StudentCekPaham,
} from "@/lib/types";

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

export async function finalizeCekPaham(id: string, input: FinalizeCekPahamInput) {
  const body = new FormData();
  if (input.audio) body.append("audio", input.audio, "jawaban");
  body.append("live_transcript", input.liveTranscript);
  body.append("client_events", JSON.stringify(input.clientEvents));
  body.append("interrupted", input.interrupted ? "true" : "false");
  // Audio sampai 5 MB: langsung ke API dengan tiket, bukan lewat jembatan.
  return resolveJson<CekPahamFinalizeResult>(
    await directFetch(`/api/student/cekpaham/${id}/finalize`, { method: "POST", body }),
  );
}

export function reportCekPaham(id: string, input: { reason?: CekPahamReportReason; note: string }) {
  return apiFetchBrowser<StudentCekPaham>(`/api/student/cekpaham/${id}/report`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
