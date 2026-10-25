import { Megaphone, MessageSquare } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ClassChip } from "@/features/classes/components/ClassChip";
import { formatRelativeTime } from "@/lib/formatting";
import type { ForumPost } from "@/lib/types";

/** Satu topik di daftar forum lintas kelas; membuka topiknya di forum kelas yang bersangkutan. */
/** Awalan alamat kelas menurut peran: "/student/kelas" atau "/dashboard/classes". */
export function ForumPostRow({ post, classBase }: { post: ForumPost; classBase: string }) {
  return (
    <Link
      href={`${classBase}/${post.class_id}?tab=forum&post=${post.id}`}
      className="block px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <ClassChip name={post.class_name} />
        {post.kind === "announcement" ? (
          <Badge tone="brand" size="sm">
            <Megaphone className="h-3 w-3" aria-hidden="true" /> Pengumuman
          </Badge>
        ) : null}
      </div>
      <h3 className="mt-2 font-semibold text-foreground">{post.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{post.body}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>
          {post.author_name}
          {post.author_role === "teacher" ? " (Dosen)" : ""}
        </span>
        <span aria-hidden="true">·</span>
        <span>{formatRelativeTime(post.last_activity_at)}</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3 w-3" aria-hidden="true" />
          {post.reply_count} balasan
        </span>
      </p>
    </Link>
  );
}
