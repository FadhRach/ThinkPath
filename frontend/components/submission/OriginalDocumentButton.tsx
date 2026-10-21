"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api-shared";
import { readAuthTokenFromBrowser } from "@/lib/auth-token";

/** Buka berkas yang diunggah mahasiswa. Memakai fetch agar token ikut terkirim. */
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
      const response = await fetchApi(path, {}, readAuthTokenFromBrowser());
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
      {error ? <span role="alert" className="text-body-sm text-danger">{error}</span> : null}
    </span>
  );
}
