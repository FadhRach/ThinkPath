export type ForumPostKind = "announcement" | "discussion";

/** Penulis kosong hanya mungkin dosen yang akunnya sudah dihapus. */
export type ForumAuthorRole = "teacher" | "student";

export interface ForumPost {
  id: string;
  class_id: string;
  class_name: string;
  kind: ForumPostKind;
  title: string;
  body: string;
  author_name: string;
  author_role: ForumAuthorRole;
  /** Penulisnya adalah pemanggil: tombol hapus miliknya tampil. */
  is_mine: boolean;
  reply_count: number;
  created_at: string;
  last_activity_at: string;
}

export interface ForumReply {
  id: string;
  post_id: string;
  author_name: string;
  author_role: ForumAuthorRole;
  is_mine: boolean;
  body: string;
  created_at: string;
}

export interface ForumPostDetail extends ForumPost {
  replies: ForumReply[];
}
