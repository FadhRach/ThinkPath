"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { directFetch } from "@/lib/api/direct";

/** Buka berkas yang diunggah mahasiswa. Memakai tiket unggah: berkas bisa 10 MB, melewati batas fungsi Vercel. */
export function OriginalDocumentButton({
  path,
  label = "Lihat berkas asli",
}: {
  path: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setPending(true);
    setError(null);
    try {
      const response = await directFetch(path);
      if (response.status === 404) {
        setError("Berkas aslinya sudah tidak ada di server.");
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      // PDF dan gambar tampil di tab baru; DOCX tidak bisa dirender peramban.
      if (blob.type === "application/pdf" || blob.type.startsWith("image/")) {
        window.open(url, "_blank", "noopener");
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = "jawaban.docx";
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Berkas tidak dapat dibuka.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={open}>
        <FileDown className="h-4 w-4" aria-hidden="true" />
        {pending ? "Membuka..." : label}
      </Button>
      {error ? (
        <span role="alert" className="text-body-sm text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
