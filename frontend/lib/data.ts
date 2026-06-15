import { apiFetch } from "./api";
import type {
  AssignmentSummary,
  ClassSummary,
  Profile,
  SubmissionDetail,
  SubmissionRow,
} from "./types";

export function getMe() {
  return apiFetch<Profile>("/api/me");
}

export function getClasses() {
  return apiFetch<ClassSummary[]>("/api/classes");
}

export function getAssignments(classId: string) {
  return apiFetch<AssignmentSummary[]>(`/api/classes/${classId}/assignments`);
}

export function getSubmissions(assignmentId: string) {
  return apiFetch<SubmissionRow[]>(
    `/api/assignments/${assignmentId}/submissions`,
  );
}

export function getSubmissionDetail(submissionId: string) {
  return apiFetch<SubmissionDetail>(`/api/submissions/${submissionId}`);
}
