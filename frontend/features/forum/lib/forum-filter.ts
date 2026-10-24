import type { ForumPost, ForumPostKind } from "@/lib/types";

export type ForumKindFilter = "semua" | ForumPostKind;

export interface ForumFilters {
  query: string;
  /** "semua" atau id kelas. */
  classId: string;
  kind: ForumKindFilter;
}

/** Saring topik menurut kelas, jenis, dan kata kunci (judul, isi, penulis, atau nama kelas). */
export function filterPosts(
  posts: ForumPost[],
  { query, classId, kind }: ForumFilters,
): ForumPost[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return posts.filter((post) => {
    if (classId !== "semua" && post.class_id !== classId) return false;
    if (kind !== "semua" && post.kind !== kind) return false;
    const haystack =
      `${post.title} ${post.body} ${post.author_name} ${post.class_name}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
