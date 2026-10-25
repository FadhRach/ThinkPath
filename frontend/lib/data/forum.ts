import { apiFetch } from "@/lib/api/server";
import type { ForumPost } from "@/lib/types";

export function getClassForum(classId: string) {
  return apiFetch<ForumPost[]>(`/api/classes/${classId}/forum`);
}

/** Aktivitas forum terbaru di semua kelas yang diikuti mahasiswa. */
export function getForumFeed(limit = 6) {
  return apiFetch<ForumPost[]>(`/api/student/forum/recent?limit=${limit}`);
}

/**
 * Topik forum dari beberapa kelas, aktivitas terbaru di atas. Forum satu kelas yang gagal dimuat
 * tidak boleh mengosongkan seluruh halaman.
 */
export async function getForumsOf(classIds: string[]) {
  const perClass = await Promise.all(classIds.map((id) => getClassForum(id).catch(() => [])));
  return perClass.flat().sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at));
}
