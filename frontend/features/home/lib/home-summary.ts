import type { StudentClassWithAssignments } from "@/lib/types";

/** Sapaan memakai nama depan; nama bernomor ("Mahasiswa 05") dipakai utuh karena nomornya yang membedakan. */
export function firstNameOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]) ? name : parts[0] || name;
}

/** Tiga nilai terbaru dari seluruh kelas. */
export function recentGrades(classes: StudentClassWithAssignments[]) {
  return classes
    .flatMap((classroom) =>
      classroom.assignments.flatMap((assignment) =>
        assignment.submission?.status === "reviewed" &&
        typeof assignment.submission.grade === "number"
          ? [{ ...assignment, className: classroom.name }]
          : [],
      ),
    )
    .sort((a, b) =>
      (b.submission?.submitted_at ?? "").localeCompare(a.submission?.submitted_at ?? ""),
    )
    .slice(0, 3);
}
