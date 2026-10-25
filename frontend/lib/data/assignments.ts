import { apiFetch } from "@/lib/api/server";
import type { AssignmentSummary, StudentAssignmentDetail, TeacherAssignmentRow } from "@/lib/types";

export function getAllAssignments() {
  return apiFetch<TeacherAssignmentRow[]>("/api/assignments");
}

export function getTeacherAssignment(assignmentId: string) {
  return apiFetch<AssignmentSummary>(`/api/assignments/${assignmentId}`);
}

export function getAssignments(classId: string) {
  return apiFetch<AssignmentSummary[]>(`/api/classes/${classId}/assignments`);
}

export function getStudentAssignment(assignmentId: string) {
  return apiFetch<StudentAssignmentDetail>(`/api/student/assignments/${assignmentId}`);
}
