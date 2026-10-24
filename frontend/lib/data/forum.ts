import { apiFetch } from "@/lib/api/server";
import type { ForumPost } from "@/lib/types";

export function getClassForum(classId: string) {
  return apiFetch<ForumPost[]>(`/api/classes/${classId}/forum`);
}

/** Aktivitas forum terbaru di semua kelas yang diikuti mahasiswa. */
export function getForumFeed(limit = 6) {
  return apiFetch<ForumPost[]>(`/api/student/forum/recent?limit=${limit}`);
}
