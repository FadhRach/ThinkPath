import type { StudentAssignment } from "./assignments";
import type { EducationLevel, StudentMini } from "./common";
import type { StudentSubmissionStatus } from "./submissions";

export interface ClassPublic {
  id: string;
  name: string;
  subject: string;
  education_level: EducationLevel;
  /** Prodi penyelenggara. Kosong untuk mata kuliah umum atau kelas lintas prodi. */
  program_studi: string;
  /** Semester penyelenggaraan kelas, bukan semester mahasiswa. */
  semester: number | null;
  /** Dosennya sudah menghapus akun: kelas hanya bisa dibaca. */
  is_archived: boolean;
  owner_left_at: string | null;
}

export interface StudentClassWithAssignments extends ClassPublic {
  teacher_name: string | null;
  joined_at: string;
  assignments: Array<StudentAssignment & { submission: StudentSubmissionStatus | null }>;
}

export interface JoinClassResult {
  class: ClassPublic;
  created: boolean;
}

export interface ClassSummary {
  id: string;
  name: string;
  subject: string;
  education_level: EducationLevel;
  program_studi: string;
  semester: number | null;
  join_code: string;
  assignment_count: number;
  created_at: string;
}

export interface ClassRosterStudent extends StudentMini {
  joined_at: string;
  submission_count: number;
  reviewed_count: number;
}

/** Dosen dan teman sekelas yang dilihat mahasiswa anggota kelas; hanya nama tampil. */
export interface ClassPeople {
  teacher: { display_name: string } | null;
  students: { id: string; display_name: string; is_me: boolean }[];
}
