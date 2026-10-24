import { isOpenAssignment } from "@/features/classes/lib/student-class";
import type { StudentClassWithAssignments } from "@/lib/types";

/** Sapaan memakai nama depan; nama bernomor ("Mahasiswa 05") dipakai utuh karena nomornya yang membedakan. */
export function firstNameOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]) ? name : parts[0] || name;
}

/** Ringkasan beranda mahasiswa dari seluruh kelas yang diikuti. */
export function summarizeStudentHome(classes: StudentClassWithAssignments[]) {
  const assignments = classes.flatMap((classroom) =>
    classroom.assignments.map((assignment) => ({ ...assignment, className: classroom.name })),
  );
  const pending = assignments.filter(isOpenAssignment);
  const graded = assignments.filter(
    (item) => item.submission?.status === "reviewed" && typeof item.submission.grade === "number",
  );
  const averageGrade = graded.length
    ? Math.round(
        (graded.reduce((sum, item) => sum + item.submission!.grade!, 0) / graded.length) * 10,
      ) / 10
    : null;
  const nextTask = [...pending].sort((a, b) =>
    (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"),
  )[0];
  const recentGrades = [...graded]
    .sort((a, b) =>
      (b.submission?.submitted_at ?? "").localeCompare(a.submission?.submitted_at ?? ""),
    )
    .slice(0, 3);

  return { assignments, pending, averageGrade, nextTask, recentGrades };
}
