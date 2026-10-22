import { cache } from "react";

import { apiFetch } from "./api";
import type {
  Announcement,
  ClassRosterStudent,
  TeacherSubmissionRow,
  AssignmentSummary,
  CekPahamDetail,
  CekPahamRow,
  ClassSummary,
  CognitiveProfile,
  ConsentStatus,
  Material,
  OwnProgress,
  Profile,
  ReportPayload,
  ScheduleItem,
  StudentAssignmentDetail,
  StudentCekPaham,
  StudentClassWithAssignments,
  SubmissionDetail,
  SubmissionRow,
  TeacherAssignmentRow,
  TeacherOverview,
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

export function getClasses() {
  return apiFetch<ClassSummary[]>("/api/classes");
}

export function getClassRoster(classId: string) {
  return apiFetch<ClassRosterStudent[]>(`/api/classes/${classId}/students`);
}

export function getClassAnnouncements(classId: string) {
  return apiFetch<Announcement[]>(`/api/classes/${classId}/announcements`);
}

export function getTeacherAssignment(assignmentId: string) {
  return apiFetch<AssignmentSummary>(`/api/assignments/${assignmentId}`);
}

export function getTeacherSubmissions(status: "all" | "submitted" | "reviewed" = "all") {
  return apiFetch<TeacherSubmissionRow[]>(`/api/submissions?status=${status}`);
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

export function getConsent() {
  return apiFetch<ConsentStatus>("/api/me/consent");
}

export function getClassMaterials(classId: string) {
  return apiFetch<Material[]>(`/api/classes/${classId}/materials`);
}

export function getStudentMaterials() {
  return apiFetch<Material[]>("/api/student/materials");
}

/**
 * Tanpa rentang: agenda yang akan datang (kartu beranda). Dengan rentang:
 * seluruh agenda di antara dua titik waktu, termasuk yang sudah lewat, untuk
 * tampilan kalender.
 */
export function getStudentSchedule(range?: { start: string; end: string }) {
  const query = range
    ? `?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`
    : "";
  return apiFetch<ScheduleItem[]>(`/api/student/schedule${query}`);
}

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
