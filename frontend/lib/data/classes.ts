import { apiFetch } from "@/lib/api/server";
import type {
  ClassPeople,
  ClassRosterStudent,
  ClassSummary,
  StudentClassWithAssignments,
} from "@/lib/types";

export function getClasses() {
  return apiFetch<ClassSummary[]>("/api/classes");
}

export function getClassRoster(classId: string) {
  return apiFetch<ClassRosterStudent[]>(`/api/classes/${classId}/students`);
}

export function getStudentClasses() {
  return apiFetch<StudentClassWithAssignments[]>("/api/student/classes");
}

export function getClassPeople(classId: string) {
  return apiFetch<ClassPeople>(`/api/classes/${classId}/people`);
}
