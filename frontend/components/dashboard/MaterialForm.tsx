"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMaterial, updateMaterial } from "@/lib/mutations";
import type { Material } from "@/lib/types";
import { useAction } from "@/lib/use-action";

interface Props {
  classId: string;
  /** Topik yang sudah dipakai di kelas ini, disarankan saat mengetik. */
  topics: string[];
  /** Diisi saat mengubah materi yang sudah ada. */
  material?: Material;
}

/**
 * Validasi yang sama dengan backend, dijalankan lebih dulu di sini. Galat
 * validasi per-kolom dari DRF tidak diterjemahkan menjadi pesan, jadi tanpa
 * ini dosen hanya melihat pesan umum "gagal menyimpan".
 */
function validate(description: string, url: string): string | null {
  if (!description.trim() && !url.trim()) {
    return "Isi ringkasan materi atau tautannya, minimal salah satu.";
  }
  if (url.trim() && !/^https?:\/\//i.test(url.trim())) {
    return "Tautan harus diawali http:// atau https://.";
  }
  return null;
}

export function MaterialForm({ classId, topics, material }: Props) {
  const editing = material !== undefined;
  const [title, setTitle] = useState(material?.title ?? "");
  const [topic, setTopic] = useState(material?.topic ?? "");
  const [url, setUrl] = useState(material?.url ?? "");
  const [description, setDescription] = useState(material?.description ?? "");
  const { pending, error, setError, run, router } = useAction(
    editing
      ? "Gagal menyimpan perubahan. Periksa isian lalu coba lagi."
      : "Gagal membagikan materi. Periksa isian lalu coba lagi.",
  );
  const backHref = `/dashboard/classes/${classId}?tab=materi`;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate(description, url);
    if (problem) {
      setError(problem);
      return;
    }
    const input = {
      title: title.trim(),
      topic: topic.trim(),
      description: description.trim(),
      url: url.trim(),
    };
    await run(
      () => (material ? updateMaterial(material.id, input) : createMaterial(classId, input)),
      (saved) => {
        // Kembali ke tab Materi dan langsung ke materi yang baru disimpan.
        router.push(`${backHref}#materi-${saved.id}`);
        router.refresh();
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="material-title">Judul materi</Label>
        <Input
          id="material-title"
          type="text"
          required
          maxLength={160}
          placeholder="Contoh: Slide analisis data kualitatif"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="material-topic">Topik atau pertemuan (opsional)</Label>
        <Input
          id="material-topic"
          type="text"
          list="material-topics"
          maxLength={80}
          placeholder="Contoh: Pertemuan 5: Analisis data kualitatif"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        />
        <datalist id="material-topics">
          {topics.map((existing) => (
            <option key={existing} value={existing} />
          ))}
        </datalist>
        <p className="text-caption text-muted-foreground">
          Materi dengan topik yang sama dikelompokkan bersama di halaman mahasiswa.
          Kosongkan untuk materi umum seperti silabus.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="material-url">Tautan (opsional)</Label>
        <Input
          id="material-url"
          type="url"
          inputMode="url"
          maxLength={500}
          placeholder="https://drive.google.com/..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <p className="text-caption text-muted-foreground">
          Slide, video, atau bacaan yang sudah Anda simpan di Google Drive, YouTube,
          atau situs lain.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="material-description">Ringkasan atau arahan</Label>
        <Textarea
          id="material-description"
          rows={5}
          maxLength={4000}
          placeholder="Apa yang perlu diperhatikan mahasiswa dari materi ini?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !title.trim()}>
          {pending
            ? editing
              ? "Menyimpan..."
              : "Membagikan..."
            : editing
              ? "Simpan perubahan"
              : "Bagikan ke kelas"}
        </Button>
        <Button asChild variant="ghost" disabled={pending}>
          <Link href={backHref}>Batal</Link>
        </Button>
      </div>
    </form>
  );
}
