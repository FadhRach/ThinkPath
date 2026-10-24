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
