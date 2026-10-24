import { apiFetch } from "@/lib/api/server";
import type { Material } from "@/lib/types";

export function getClassMaterials(classId: string) {
  return apiFetch<Material[]>(`/api/classes/${classId}/materials`);
}

export function getStudentMaterials() {
  return apiFetch<Material[]>("/api/student/materials");
}
