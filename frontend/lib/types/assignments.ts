import type { ClassPublic } from "./classes";
import type { EducationLevel } from "./common";
import type { StudentSubmissionWithText } from "./submissions";

/** Baris pada halaman Daftar Tugas dosen: sama seperti AssignmentSummary,
 *  ditambah asal kelasnya karena di sana tugas lintas kelas bercampur. */
export interface TeacherAssignmentRow extends AssignmentSummary {
  class_name: string;
  subject: string;
}

export interface StudentAssignment {
  id: string;
  title: string;
  instructions: string;
  deadline: string | null;
  expected_bloom_level: number;
  /** Dosen mengizinkan jawaban diisi dari berkas; bila false, wajib diketik. */
  allow_file_upload: boolean;
  education_level: EducationLevel;
}

/** Draf tersimpan di server; ada hanya setelah mahasiswa mulai menulis. */
export interface AnswerDraft {
  text_answer: string;
  document_id: string | null;
  saved_at: string;
}

export interface StudentAssignmentDetail {
  class: ClassPublic;
  assignment: StudentAssignment;
  submission: StudentSubmissionWithText | null;
  draft: AnswerDraft | null;
}

export interface AssignmentSummary {
  id: string;
  class_id: string;
  title: string;
  instructions: string;
  deadline: string | null;
  expected_bloom_level: number;
  allow_file_upload: boolean;
  education_level: EducationLevel;
  submission_count: number;
  high_band_count: number;
  needs_review_count: number;
  created_at: string;
}
