import { apiFetchBrowser } from "@/lib/api/browser";
import type { ForumPost, ForumPostDetail, ForumPostKind, ForumReply } from "@/lib/types";

export interface CreateForumPostInput {
  kind: ForumPostKind;
  title: string;
  body: string;
}

export function createForumPost(classId: string, input: CreateForumPostInput) {
  return apiFetchBrowser<ForumPost>(`/api/classes/${classId}/forum`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Satu topik beserta balasannya; dimuat saat topik dibuka. */
export function fetchForumPost(postId: string) {
  return apiFetchBrowser<ForumPostDetail>(`/api/forum/posts/${postId}`);
}

export function createForumReply(postId: string, body: string) {
  return apiFetchBrowser<ForumReply>(`/api/forum/posts/${postId}/replies`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function deleteForumPost(postId: string) {
  return apiFetchBrowser<void>(`/api/forum/posts/${postId}`, { method: "DELETE" });
}

export function deleteForumReply(replyId: string) {
  return apiFetchBrowser<void>(`/api/forum/replies/${replyId}`, { method: "DELETE" });
}
