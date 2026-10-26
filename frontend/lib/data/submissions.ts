import { apiFetch } from "@/lib/api/server";
import type { SubmissionDetail, SubmissionRow, TeacherSubmissionRow } from "@/lib/types";

export function getTeacherSubmissions(
  status: "all" | "submitted" | "reviewed" = "all",
  /** Bawaan server 200 baris terbaru; halaman Periksa butuh semuanya (maks 2000). */
  limit?: number,
) {
  const query = limit ? `&limit=${limit}` : "";
  return apiFetch<TeacherSubmissionRow[]>(`/api/submissions?status=${status}${query}`);
}

export function getSubmissions(assignmentId: string) {
  return apiFetch<SubmissionRow[]>(`/api/assignments/${assignmentId}/submissions`);
}

export function getSubmissionDetail(submissionId: string) {
  return apiFetch<SubmissionDetail>(`/api/submissions/${submissionId}`);
}
