"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { uploadDocument, type DocumentImportResult } from "@/lib/mutations";
import { useAction } from "@/hooks/use-action";

const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg";
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  assignmentId: string;
  onImported: (result: DocumentImportResult, filename: string) => void;
}

/** Pilih berkas, kirim ke backend, lalu serahkan teks hasilnya ke editor. */
export function DocumentUploadField({ assignmentId, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const { pending, error, run } = useAction(
    "Gagal membaca dokumen. Coba lagi atau ketik jawabanmu.",
  );

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // berkas yang sama boleh dipilih ulang
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setSizeError("Ukuran berkas maksimal 10 MB.");
      return;
    }
    setSizeError(null);
    await run(
      () => uploadDocument(assignmentId, file),
      (result) => onImported(result, file.name),
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleChange}
          className="sr-only"
          tabIndex={-1}
          aria-label="Pilih dokumen jawaban"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="h-4 w-4" />
          {pending ? "Membaca dokumen..." : "Unggah dokumen"}
        </Button>
        <span className="text-caption text-muted-foreground">
          PDF, DOCX, PNG, atau JPG, maksimal 10 MB. Teksnya masuk ke kotak di bawah untuk kamu
          periksa.
        </span>
      </div>
      {sizeError || error ? <p className="text-body-sm text-danger">{sizeError ?? error}</p> : null}
    </div>
  );
}
