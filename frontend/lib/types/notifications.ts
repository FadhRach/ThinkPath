export type NotificationKind =
  | "announcement_new"
  | "assignment_new"
  | "material_new"
  | "submission_graded"
  | "deadline_soon"
  | "cekpaham_new"
  | "cekpaham_resolved"
  | "forum_post_new"
  | "forum_reply_new"
  | "cekpaham_result"
  | "submissions_new"
  | "students_joined";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  /** Waktu yang dibicarakan notifikasi, misalnya tenggat atau jadwal sesi. */
  event_at: string | null;
  count: number;
  created_at: string;
  read: boolean;
}

export interface NotificationInbox {
  unread_count: number;
  items: NotificationItem[];
}
