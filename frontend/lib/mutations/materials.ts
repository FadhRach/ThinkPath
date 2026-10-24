import { apiFetchBrowser } from "@/lib/api/browser";
import type { Material } from "@/lib/types";

export interface MaterialInput {
  title: string;
  topic: string;
  description: string;
  url: string;
}

export function createMaterial(classId: string, input: MaterialInput) {
  return apiFetchBrowser<Material>(`/api/classes/${classId}/materials`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Mengubah materi tidak mengirim notifikasi ulang ke mahasiswa. */
export function updateMaterial(materialId: string, input: MaterialInput) {
  return apiFetchBrowser<Material>(`/api/materials/${materialId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMaterial(materialId: string) {
  return apiFetchBrowser<void>(`/api/materials/${materialId}`, { method: "DELETE" });
}
