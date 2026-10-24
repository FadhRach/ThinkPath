"use client";

import { ChevronDown, Megaphone, MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAction } from "@/hooks/use-action";
import { AuthorLine } from "@/features/forum/components/AuthorLine";
import { ForumThread } from "@/features/forum/components/ForumThread";
import { deleteForumPost } from "@/lib/mutations";
import type { ForumPost, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ForumPostCardProps {
  post: ForumPost;
  viewerRole: Role;
  readOnly: boolean;
  /** Dibuka sejak awal, mis. dari tautan notifikasi (?post=). */
  defaultOpen?: boolean;
}

/** Satu topik: ringkas saat tertutup, lengkap dengan balasan saat dibuka. */
export function ForumPostCard({
  post,
  viewerRole,
  readOnly,
  defaultOpen = false,
}: ForumPostCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const removal = useAction("Topik belum terhapus. Coba lagi.", {
    successMessage: "Topik dihapus.",
  });
  const isAnnouncement = post.kind === "announcement";
  const canDelete = post.is_mine || viewerRole === "teacher";

  useEffect(() => {
    if (defaultOpen) ref.current?.scrollIntoView({ block: "start" });
  }, [defaultOpen]);

  async function handleDelete() {
    const { ok } = await removal.run(() => deleteForumPost(post.id));
    if (ok) setConfirming(false);
  }

  return (
    <div ref={ref} id={`post-${post.id}`} className="scroll-mt-24">
      <Card className={cn("p-5", isAnnouncement && "border-primary/40 bg-secondary/20")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            {isAnnouncement ? (
              <Badge tone="brand" size="sm">
                <Megaphone className="h-3 w-3" aria-hidden="true" /> Pengumuman
              </Badge>
            ) : null}
            <h3 className="text-base font-bold leading-snug text-foreground">{post.title}</h3>
            <AuthorLine
              name={post.author_name}
              role={post.author_role}
              createdAt={post.created_at}
              extra={
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true">·</span>
                  <MessageSquare className="h-3 w-3" aria-hidden="true" />
                  {post.reply_count} balasan
                </span>
              }
            />
          </div>
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-danger-soft hover:text-danger"
              aria-label={`Hapus topik ${post.title}`}
              onClick={() => setConfirming(true)}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>

        <p
          className={cn(
            "mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground",
            !open && "line-clamp-3",
          )}
        >
          {post.body}
        </p>

        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-2 h-auto px-0"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Tutup" : post.reply_count ? `Lihat ${post.reply_count} balasan` : "Balas"}
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        </Button>

        {open ? (
          <div className="mt-3 border-t border-border pt-4">
            <ForumThread postId={post.id} viewerRole={viewerRole} readOnly={readOnly} />
          </div>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        title="Hapus topik ini?"
        description="Topik beserta seluruh balasannya akan hilang dan tidak bisa dikembalikan."
        confirmLabel="Hapus topik"
        pending={removal.pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
