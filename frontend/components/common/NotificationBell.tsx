"use client";

import {
  Bell,
  BookOpen,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Hourglass,
  Inbox,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { jadwalHref } from "@/lib/calendar";
import { dayKey, formatClockHHMM, formatDate, formatRelativeTime } from "@/lib/formatting";
import { fetchNotifications, markNotificationsRead } from "@/lib/mutations";
import type { NotificationInbox, NotificationItem, NotificationKind } from "@/lib/types";
import { cn } from "@/lib/utils";

// Cukup sering untuk terasa hidup, cukup jarang untuk tidak membebani backend
// yang juga menjalankan analisis. Lonceng juga dimuat ulang saat dibuka dan
// saat tab kembali aktif, jadi selang ini hanya jaring pengaman.
const POLL_MS = 60_000;

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  assignment_new: ClipboardList,
  material_new: BookOpen,
  submission_graded: CheckCircle2,
  session_scheduled: CalendarClock,
  session_cancelled: CalendarX2,
  deadline_soon: Hourglass,
  submissions_new: Inbox,
  students_joined: UserPlus,
};

/** Keterangan waktu kedua, untuk notifikasi yang membicarakan waktu tertentu. */
function eventLine(item: NotificationItem): string | null {
  if (!item.event_at) return null;
  if (item.kind === "session_scheduled") {
    return `Sesi ${formatDate(item.event_at)} pukul ${formatClockHHMM(item.event_at)}`;
  }
  if (item.kind === "assignment_new" || item.kind === "deadline_soon") {
    return `Tenggat ${formatRelativeTime(item.event_at)}`;
  }
  return null;
}

/**
 * Tujuan saat notifikasi diklik. Undangan sesi dibuka langsung pada pekan
 * sesinya di kalender. Tanggalnya dihitung di sini, pada zona tampilan,
 * karena backend sengaja tidak menulis tanggal lokal ke dalam tautan.
 */
function destinationOf(item: NotificationItem): string {
  if (item.kind === "session_scheduled" && item.event_at) {
    return jadwalHref({ view: "minggu", date: dayKey(item.event_at) });
  }
  return item.link;
}

export function NotificationBell() {
  const router = useRouter();
  const [inbox, setInbox] = useState<NotificationInbox | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setInbox(await fetchNotifications());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
  }

  function markLocally(ids: string[] | null) {
    setInbox((current) => {
      if (!current) return current;
      const items = current.items.map((item) =>
        ids === null || ids.includes(item.id) ? { ...item, read: true } : item,
      );
      return { items, unread_count: items.filter((item) => !item.read).length };
    });
  }

  function openItem(item: NotificationItem) {
    if (!item.read) {
      markLocally([item.id]);
      // Gagal menandai dibaca tidak boleh menghalangi pindah halaman.
      markNotificationsRead([item.id]).catch(() => undefined);
    }
    const destination = destinationOf(item);
    if (destination) router.push(destination);
  }

  function markAll() {
    markLocally(null);
    markNotificationsRead().catch(() => undefined);
  }

  const unread = inbox?.unread_count ?? 0;
  const items = inbox?.items ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
        className="relative grid h-10 w-10 place-items-center rounded-full text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted data-[state=open]:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-primary px-1 text-[0.625rem] font-bold leading-none text-primary-foreground ring-2 ring-card">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[23rem] max-w-[calc(100vw-1.5rem)] p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="text-body font-semibold text-foreground">Notifikasi</p>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAll}
              className="text-body-sm font-medium text-primary hover:underline"
            >
              Tandai semua dibaca
            </button>
          ) : null}
        </div>

        <div className="max-h-[26rem] overflow-y-auto py-1">
          {failed && !inbox ? (
            <p className="px-4 py-8 text-center text-body-sm text-muted-foreground">
              Notifikasi gagal dimuat. Coba buka lagi sebentar lagi.
            </p>
          ) : !inbox ? (
            <p className="px-4 py-8 text-center text-body-sm text-muted-foreground">
              Memuat notifikasi...
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-sm text-muted-foreground">
              Belum ada notifikasi.
            </p>
          ) : (
            items.map((item) => {
              const Icon = KIND_ICON[item.kind] ?? Bell;
              const when = eventLine(item);
              return (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => openItem(item)}
                  className={cn(
                    "mx-1 flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5",
                    !item.read && "bg-secondary/25",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
                      item.read ? "bg-muted text-muted-foreground" : "bg-secondary text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span
                      className={cn(
                        "block text-body-sm leading-snug text-foreground",
                        !item.read && "font-semibold",
                      )}
                    >
                      {item.title}
                    </span>
                    {item.body ? (
                      <span className="block text-caption text-muted-foreground">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="block text-caption text-muted-foreground">
                      {formatRelativeTime(item.created_at)}
                      {when ? ` · ${when}` : ""}
                    </span>
                  </span>
                  {!item.read ? (
                    <span
                      aria-label="Belum dibaca"
                      className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
