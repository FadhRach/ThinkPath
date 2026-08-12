import { cache } from "react";

import { apiFetch } from "./api";
import type {
  AssignmentSummary,
  ClassSummary,
  CognitiveProfile,
  OwnProgress,
  Profile,
  ReportPayload,
  StudentAssignmentDetail,
  StudentClassWithAssignments,
  SubmissionDetail,
  SubmissionRow,
  TeacherAssignmentRow,
  TeacherOverview,
  VerificationQueueRow,
} from "./types";

// Dibungkus React cache() supaya layout + page dalam satu render berbagi satu
// request /api/me, bukan memanggilnya dua kali.
export const getMe = cache(() => apiFetch<Profile>("/api/me"));

export function getOverview() {
  return apiFetch<TeacherOverview>("/api/overview");
}

export function getReportOverview() {
  return apiFetch<ReportPayload>("/api/reports/overview");
}

export function getAllAssignments() {
  return apiFetch<TeacherAssignmentRow[]>("/api/assignments");
}

export function getStudentProfile(studentId: string) {
  return apiFetch<CognitiveProfile>(`/api/students/${studentId}/profile`);
}

export function getOwnProgress() {
  return apiFetch<OwnProgress>("/api/student/progress");
}

export function getVerificationQueue() {
  return apiFetch<VerificationQueueRow[]>("/api/verifications");
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

export function getStudentClasses() {
  return apiFetch<StudentClassWithAssignments[]>("/api/student/classes");
}

export function getStudentAssignment(assignmentId: string) {
  return apiFetch<StudentAssignmentDetail>(
    `/api/student/assignments/${assignmentId}`,
  );
}
