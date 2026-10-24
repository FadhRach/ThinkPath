import { academicLabel, distinctSubject } from "@/features/classes/lib/academic";
import type { Material, StudentClassWithAssignments } from "@/lib/types";

type StudentAssignment = StudentClassWithAssignments["assignments"][number];

/** Belum dikumpulkan: tidak ada jawaban sama sekali, atau baru berupa draf. */
export function isOpenAssignment(assignment: StudentAssignment): boolean {
  return !assignment.submission || assignment.submission.status === "draft";
}

/** Bahan tampilan halaman kelas mahasiswa: urutan tenggat, materi terbaru, dan hitungan ringkas. */
export function summarizeStudentClass(current: StudentClassWithAssignments, materials: Material[]) {
  const ownMaterials = materials
    .filter((material) => material.class_id === current.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  // Tenggat terdekat dulu; tugas tanpa tenggat di akhir.
  const assignments = [...current.assignments].sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
  return {
    ownMaterials,
    assignments,
    openCount: assignments.filter(isOpenAssignment).length,
    assignmentRefs: assignments.map(({ id, title }) => ({ id, title })),
    classMeta: [distinctSubject(current.name, current.subject), academicLabel(current)]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Tugas yang sudah dikumpulkan (menunggu nilai atau sudah dinilai). */
export function isDoneAssignment(assignment: StudentAssignment): boolean {
  return !isOpenAssignment(assignment);
}

/** Angka progres satu kelas untuk kartu dan kepala halaman. */
export function classProgress(classroom: StudentClassWithAssignments) {
  const total = classroom.assignments.length;
  const done = classroom.assignments.filter(isDoneAssignment).length;
  const grades = classroom.assignments.flatMap((assignment) =>
    assignment.submission?.status === "reviewed" && typeof assignment.submission.grade === "number"
      ? [assignment.submission.grade]
      : [],
  );
  const nextOpen = classroom.assignments
    .filter(isOpenAssignment)
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))[0];
  return {
    total,
    done,
    open: total - done,
    percent: total ? Math.round((done / total) * 100) : 0,
    graded: grades.length,
    average: grades.length
      ? Math.round((grades.reduce((sum, grade) => sum + grade, 0) / grades.length) * 10) / 10
      : null,
    nextOpen,
  };
}
