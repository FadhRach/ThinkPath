"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { AuthorLine } from "@/features/forum/components/AuthorLine";
import { createForumReply, deleteForumReply, fetchForumPost } from "@/lib/mutations";
import type { ForumPostDetail, ForumReply, Role } from "@/lib/types";

const BODY_MAX = 4000;

interface ForumThreadProps {
  postId: string;
  viewerRole: Role;
  /** Kelas arsip tidak menerima balasan baru. */
  readOnly: boolean;
}

/** Isi satu topik yang dibuka: balasan berurutan dan form membalas. */
export function ForumThread({ postId, viewerRole, readOnly }: ForumThreadProps) {
  const [detail, setDetail] = useState<ForumPostDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [toDelete, setToDelete] = useState<ForumReply | null>(null);
  const reply = useAction("Balasan belum terkirim. Coba lagi.", {
    successMessage: "Balasan terkirim.",
  });
  const removal = useAction("Balasan belum terhapus. Coba lagi.", {
    successMessage: "Balasan dihapus.",
  });

  const load = useCallback(async () => {
    try {
      setDetail(await fetchForumPost(postId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { ok } = await reply.run(
      () => createForumReply(postId, text.trim()),
      () => {
        void load();
        reply.router.refresh();
      },
    );
    if (ok) setText("");
  }

  async function handleDelete() {
    if (!toDelete) return;
    const { ok } = await removal.run(
      () => deleteForumReply(toDelete.id),
      () => {
        void load();
        removal.router.refresh();
      },
    );
    if (ok) setToDelete(null);
  }

  if (failed)
    return (
      <Alert variant="warning">Balasan belum bisa dimuat. Tutup lalu buka lagi topik ini.</Alert>
    );
  if (!detail)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Memuat balasan…
      </p>
    );

  return (
    <div className="space-y-4">
      {detail.replies.length ? (
        <ul className="space-y-3 border-l-2 border-border pl-4">
          {detail.replies.map((item) => (
            <li key={item.id} className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <AuthorLine
                  name={item.author_name}
                  role={item.author_role}
                  createdAt={item.created_at}
                />
                {item.is_mine || viewerRole === "teacher" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-danger-soft hover:text-danger"
                    aria-label="Hapus balasan"
                    onClick={() => setToDelete(item)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Belum ada balasan.</p>
      )}

      {readOnly ? null : (
        <form onSubmit={handleReply} className="space-y-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={BODY_MAX}
            rows={3}
            placeholder="Tulis balasan…"
            aria-label="Tulis balasan"
          />
          {reply.error ? (
            <p role="alert" className="text-sm text-danger">
              {reply.error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={reply.pending || !text.trim()}>
              {reply.pending ? "Mengirim..." : "Kirim balasan"}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        tone="danger"
        title="Hapus balasan ini?"
        description="Balasan akan hilang dari topik dan tidak bisa dikembalikan."
        confirmLabel="Hapus balasan"
        pending={removal.pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
