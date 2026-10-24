import { apiFetchBrowser } from "@/lib/api/browser";
import type { NotificationInbox } from "@/lib/types";

export function fetchNotifications() {
  return apiFetchBrowser<NotificationInbox>("/api/notifications");
}

/** Tanpa ids berarti seluruh notifikasi ditandai dibaca. */
export function markNotificationsRead(ids?: string[]) {
  return apiFetchBrowser<{ unread_count: number }>("/api/notifications/read", {
    method: "POST",
    body: JSON.stringify(ids ? { ids } : {}),
  });
}
