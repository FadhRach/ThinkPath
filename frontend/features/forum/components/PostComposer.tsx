"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { FilterPills } from "@/components/shared/FilterPills";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { createForumPost } from "@/lib/mutations";
import type { ForumPostKind, Role } from "@/lib/types";

const BODY_MAX = 4000;

/** Form topik baru. Dosen bisa memilih menerbitkan pengumuman; mahasiswa hanya membuka diskusi. */
export function PostComposer({ classId, role }: { classId: string; role: Role }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ForumPostKind>("discussion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { pending, error, run } = useAction("Topik belum terkirim. Coba lagi.", {
    successMessage: "Topik terkirim.",
  });
  const isAnnouncement = kind === "announcement";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { ok } = await run(() =>
      createForumPost(classId, { kind, title: title.trim(), body: body.trim() }),
    );
    if (ok) {
      setTitle("");
      setBody("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="w-full sm:w-fit">
        <Plus /> {role === "teacher" ? "Tulis pengumuman atau topik" : "Tanyakan sesuatu"}
      </Button>
    );
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        {role === "teacher" ? (
          <FilterPills
            label="Jenis tulisan"
            value={kind}
            onChange={setKind}
            options={[
              { value: "discussion", label: "Diskusi" },
              { value: "announcement", label: "Pengumuman" },
            ]}
          />
        ) : null}
        <FormField htmlFor="forum-title" label="Judul" required>
          <Input
            id="forum-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            minLength={3}
            required
            placeholder={
              isAnnouncement ? "Mis. UTS dimajukan ke Jumat" : "Mis. Soal nomor 3 maksudnya apa?"
            }
          />
        </FormField>
        <FormField
          htmlFor="forum-body"
          label="Isi"
          required
          hint={
            isAnnouncement
              ? "Pengumuman disematkan di atas dan memberi tahu seluruh mahasiswa."
              : undefined
          }
          error={error}
        >
          <Textarea
            id="forum-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={BODY_MAX}
            required
            rows={5}
          />
          <p className="text-right text-xs text-muted-foreground">
            {body.length}/{BODY_MAX}
          </p>
        </FormField>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button type="submit" disabled={pending || title.trim().length < 3 || !body.trim()}>
            {pending ? "Mengirim..." : isAnnouncement ? "Terbitkan pengumuman" : "Kirim topik"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
