"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchNotifications, markNotificationsRead } from "@/lib/mutations";
import { formatRelativeTime } from "@/lib/formatting";
import type { NotificationItem } from "@/lib/types";

const EMPTY_ASSIGNMENTS: Array<{ id: string; title: string }> = [];

function matchesClass(item: NotificationItem, classId: string, assignmentRefs: Array<{ id: string; title: string }>) {
  if (item.link.includes(`/student/materi/${classId}`)) return true;
  if (item.link.includes(`/student/kelas/${classId}`)) return true;
  return assignmentRefs.some(({ id, title }) => item.link.includes(id) || (title && item.body.includes(title)));
}

export function StudentUpdates({
  classId, assignmentRefs = EMPTY_ASSIGNMENTS, title = "Pengumuman kelas", compact = false,
}: {
  classId?: string;
  assignmentRefs?: Array<{ id: string; title: string }>;
  title?: string;
  compact?: boolean;
}) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchNotifications()
      .then((inbox) => {
        if (!active) return;
        const relevant = classId ? inbox.items.filter((item) => matchesClass(item, classId, assignmentRefs)) : inbox.items;
        setItems(relevant.slice(0, compact ? 3 : 6));
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [assignmentRefs, classId, compact]);

  return (
    <section aria-label={title} className={compact ? "" : "rounded-xl border border-border bg-card p-5"}>
      <h2 className={compact ? "mb-2 text-lg font-semibold" : "mb-3 text-lg font-semibold"}>{title}</h2>
      <div className="divide-y divide-border">
        {failed ? (
          <p className="py-4 text-sm text-muted-foreground">Pengumuman belum bisa dimuat. Coba lagi nanti.</p>
        ) : items === null ? (
          <p className="py-4 text-sm text-muted-foreground" role="status">Memuat pengumuman…</p>
        ) : items.length === 0 ? (
          <p className="py-4 text-sm leading-relaxed text-muted-foreground">Belum ada pengumuman baru.</p>
        ) : items.map((item) => (
          <Link
            href={item.link || "/student"}
            key={item.id}
            onClick={() => {
              if (!item.read) markNotificationsRead([item.id]).catch(() => undefined);
            }}
            className="group block py-4 first:pt-3"
          >
            <span className="flex items-start gap-2">
              <span className="line-clamp-2 text-sm font-medium leading-relaxed underline-offset-4 group-hover:underline">{item.title}</span>
              {!item.read ? <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Belum dibaca" /> : null}
            </span>
            {item.body ? <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{item.body}</span> : null}
            <span className="mt-2 block text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
