import { apiFetch } from "@/lib/api/server";
import type { SubmissionDetail, SubmissionRow, TeacherSubmissionRow } from "@/lib/types";

export function getTeacherSubmissions(status: "all" | "submitted" | "reviewed" = "all") {
  return apiFetch<TeacherSubmissionRow[]>(`/api/submissions?status=${status}`);
}

export function getSubmissions(assignmentId: string) {
  return apiFetch<SubmissionRow[]>(`/api/assignments/${assignmentId}/submissions`);
}

export function getSubmissionDetail(submissionId: string) {
  return apiFetch<SubmissionDetail>(`/api/submissions/${submissionId}`);
}
