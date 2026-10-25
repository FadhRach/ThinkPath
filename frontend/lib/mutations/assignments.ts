import { apiFetchBrowser } from "@/lib/api/browser";
import type { AssignmentSummary, RichDoc } from "@/lib/types";

/** Jenjang tidak dikirim: tugas mewarisinya dari kelas. */
export interface CreateAssignmentInput {
  title: string;
  /** Dokumen editor; server menurunkan teks polosnya sendiri. */
  instructions_rich: RichDoc;
  deadline: string;
  expected_bloom_level: number;
  allow_file_upload: boolean;
}

export function createAssignment(classId: string, input: CreateAssignmentInput) {
  return apiFetchBrowser<AssignmentSummary>(`/api/classes/${classId}/assignments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAssignment(assignmentId: string, input: CreateAssignmentInput) {
  return apiFetchBrowser<AssignmentSummary>(`/api/assignments/${assignmentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
