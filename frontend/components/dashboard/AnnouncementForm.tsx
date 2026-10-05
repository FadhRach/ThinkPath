"use client";
import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAnnouncement } from "@/lib/mutations";
import { useAction } from "@/lib/use-action";

export function AnnouncementForm({ classId }: { classId: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const { pending, error, run } = useAction("Pengumuman belum tersimpan. Coba lagi.");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const { ok } = await run(() => createAnnouncement(classId, { title: title.trim(), body: body.trim() }));
    if (ok) { setTitle(""); setBody(""); setMessage("Pengumuman diterbitkan dan notifikasi dikirim ke mahasiswa."); }
  }
  return <Card className="campus-card p-5"><h2 className="font-semibold">Bagikan pengumuman</h2><p className="mt-1 text-sm text-muted-foreground">Sampaikan informasi penting kepada seluruh mahasiswa kelas.</p><form onSubmit={submit} className="mt-4 space-y-4"><div className="space-y-1.5"><Label htmlFor="announcement-title">Judul</Label><Input id="announcement-title" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Persiapan pertemuan berikutnya" /></div><div className="space-y-1.5"><Label htmlFor="announcement-body">Isi pengumuman</Label><Textarea id="announcement-body" required rows={4} maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Tulis informasi yang perlu diketahui mahasiswa…" /></div><div aria-live="polite">{message ? <p className="text-sm text-accent-foreground">{message}</p> : null}{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}</div><Button disabled={pending} type="submit" className="w-full rounded-xl sm:w-auto"><Send className="mr-2 h-4 w-4" />{pending ? "Menerbitkan…" : "Terbitkan pengumuman"}</Button></form></Card>;
}
