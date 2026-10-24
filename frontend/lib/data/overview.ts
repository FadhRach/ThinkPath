import { apiFetch } from "@/lib/api/server";
import type { CognitiveProfile, OwnProgress, TeacherOverview } from "@/lib/types";

export function getOverview() {
  return apiFetch<TeacherOverview>("/api/overview");
}

export function getStudentProfile(studentId: string) {
  return apiFetch<CognitiveProfile>(`/api/students/${studentId}/profile`);
}

export function getOwnProgress() {
  return apiFetch<OwnProgress>("/api/student/progress");
}
