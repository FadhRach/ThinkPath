import { apiFetch } from "@/lib/api/server";
import type { CekPahamDetail, CekPahamRow, StudentCekPaham } from "@/lib/types";

export function getCekPahamQueue() {
  return apiFetch<CekPahamRow[]>("/api/cekpaham");
}

export function getSubmissionCekPaham(submissionId: string) {
  return apiFetch<CekPahamRow[]>(`/api/submissions/${submissionId}/cekpaham`);
}

export function getCekPahamDetail(id: string) {
  return apiFetch<CekPahamDetail>(`/api/cekpaham/${id}`);
}

export function getStudentCekPaham(id: string) {
  return apiFetch<StudentCekPaham>(`/api/student/cekpaham/${id}`);
}
