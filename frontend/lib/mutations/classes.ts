import { apiFetchBrowser } from "@/lib/api/browser";
import type { Announcement, ClassSummary, EducationLevel, JoinClassResult } from "@/lib/types";

export interface CreateClassInput {
  name: string;
  subject: string;
  education_level: EducationLevel;
  program_studi: string;
  semester: number | null;
}

export function createClass(input: CreateClassInput) {
  return apiFetchBrowser<ClassSummary>("/api/classes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createAnnouncement(classId: string, input: { title: string; body: string }) {
  return apiFetchBrowser<Announcement>(`/api/classes/${classId}/announcements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function joinClass(joinCode: string) {
  return apiFetchBrowser<JoinClassResult>("/api/join", {
    method: "POST",
    body: JSON.stringify({ join_code: joinCode }),
  });
}
