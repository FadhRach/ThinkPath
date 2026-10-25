import { Megaphone, MessagesSquare } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { formatRelativeTime } from "@/lib/formatting";
import type { ForumPost } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Pengumuman dan diskusi terbaru dari semua kelas; tiap baris menuju topiknya di forum kelas. */
export function ForumFeedCard({
  posts,
  title = "Pengumuman & forum",
  href = "/student/forum",
  classBase = "/student/kelas",
  scrollable = false,
  fill = false,
}: {
  posts: ForumPost[];
  title?: string;
  /** Tujuan tautan "Semua"; bawaannya halaman Forum. */
  href?: string;
  /** Awalan alamat kelas menurut peran. */
  classBase?: string;
  /** Batasi tinggi daftar dan gulir di dalam kartu (untuk beranda, agar tata letak tetap rapi). */
  scrollable?: boolean;
  /** Isi tinggi kartu induk dan gulir daftar di dalamnya (kolom kanan beranda dosen). */
  fill?: boolean;
}) {
  return (
    <Card className={cn("p-5", fill && "flex h-full flex-col")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconTile icon={MessagesSquare} size="sm" />
          <h2 className="font-bold text-foreground">{title}</h2>
        </div>
        <Link href={href} className="text-xs font-semibold text-brand-ink hover:underline">
          Semua
        </Link>
      </div>
      {posts.length ? (
        <ul
          className={cn(
            "mt-3 divide-y divide-border/60",
            scrollable && "max-h-80 overflow-y-auto pr-1",
            fill && "max-h-96 overflow-y-auto pr-1 xl:max-h-none xl:min-h-0 xl:flex-1",
          )}
        >
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`${classBase}/${post.class_id}?tab=forum&post=${post.id}`}
                className="block py-3 hover:underline"
              >
                <span className="flex items-start gap-2">
                  {post.kind === "announcement" ? (
                    <Badge tone="brand" size="sm" className="mt-0.5 shrink-0">
                      <Megaphone className="h-3 w-3" aria-hidden="true" /> Info
                    </Badge>
                  ) : null}
                  <span className="line-clamp-2 text-sm font-medium leading-snug">
                    {post.title}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {post.class_name} · {formatRelativeTime(post.last_activity_at)}
                  {post.reply_count ? ` · ${post.reply_count} balasan` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Belum ada pengumuman. Pengumuman dosen dan diskusi kelas akan muncul di sini.
        </p>
      )}
    </Card>
  );
}
