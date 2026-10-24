import { apiFetch } from "@/lib/api/server";
import type {
  Announcement,
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

export function getClassAnnouncements(classId: string) {
  return apiFetch<Announcement[]>(`/api/classes/${classId}/announcements`);
}

export function getStudentClasses() {
  return apiFetch<StudentClassWithAssignments[]>("/api/student/classes");
}
