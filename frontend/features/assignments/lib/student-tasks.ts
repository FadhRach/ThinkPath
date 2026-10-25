import { distinctSubject } from "@/features/classes/lib/academic";
import type { StudentClassWithAssignments, StudentSubmissionStatus } from "@/lib/types";

export interface StudentTaskRow {
  assignmentId: string;
  title: string;
  classId: string;
  className: string;
  subject: string | null;
  deadline: string | null;
  expectedLevel: number;
  submission: StudentSubmissionStatus | null;
}

export type TaskGroupKey = "todo" | "waiting" | "graded";

const byDeadline = (a: StudentTaskRow, b: StudentTaskRow) =>
  (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");

/** Satu baris per tugas dari semua kelas. */
export function buildTaskRows(classes: StudentClassWithAssignments[]): StudentTaskRow[] {
  return classes.flatMap((studentClass) =>
    studentClass.assignments.map((assignment) => ({
      assignmentId: assignment.id,
      title: assignment.title,
      classId: studentClass.id,
      className: studentClass.name,
      subject: distinctSubject(studentClass.name, studentClass.subject),
      deadline: assignment.deadline,
      expectedLevel: assignment.expected_bloom_level,
      submission: assignment.submission,
    })),
  );
}

function isUnfinished(row: StudentTaskRow): boolean {
  return !row.submission || row.submission.status === "draft";
}

/**
 * Tiga kelompok menurut apa yang harus dilakukan mahasiswa: kerjakan (tenggat terdekat dulu),
 * tunggu nilai, dan sudah dinilai (yang terbaru dulu).
 */
export function groupTasks(rows: StudentTaskRow[]): Record<TaskGroupKey, StudentTaskRow[]> {
  const sorted = [...rows].sort(byDeadline);
  return {
    todo: sorted.filter(isUnfinished),
    waiting: sorted.filter((row) => row.submission?.status === "submitted"),
    graded: sorted.filter((row) => row.submission?.status === "reviewed").reverse(),
  };
}

export type TaskStatusFilter = "semua" | TaskGroupKey;

interface TaskFilters {
  query: string;
  /** "semua" atau id kelas. */
  classId: string;
}

/** Saring menurut kelas dan kata kunci; setiap kata harus ada di judul, nama kelas, atau mata kuliah. */
export function filterTasks(
  rows: StudentTaskRow[],
  { query, classId }: TaskFilters,
): StudentTaskRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (classId !== "semua" && row.classId !== classId) return false;
    const haystack = `${row.title} ${row.className} ${row.subject ?? ""}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
