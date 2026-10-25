"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api/messages";
import { uploadDocument, type DocumentImportResult } from "@/lib/mutations";

const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg";
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  assignmentId: string;
  onImported: (result: DocumentImportResult, filename: string) => void;
  onError: (message: string) => void;
  onPending: (pending: boolean) => void;
  pending: boolean;
  disabled?: boolean;
  label?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}

/** Tombol pilih berkas: kirim ke backend, lalu serahkan teks hasil bacanya ke induk. */
export function DocumentUploadField({
  assignmentId,
  onImported,
  onError,
  onPending,
  pending,
  disabled,
  label = "Pilih dokumen",
  variant = "default",
  size = "default",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // berkas yang sama boleh dipilih ulang
    if (!file) return;
    if (file.size > MAX_BYTES) {
      onError("Ukuran berkas maksimal 10 MB.");
      return;
    }
    onPending(true);
    try {
      onImported(await uploadDocument(assignmentId, file), file.name);
    } catch (error) {
      onError(getApiErrorMessage(error, "Gagal membaca dokumen. Coba lagi atau ketik jawabanmu."));
    } finally {
      onPending(false);
    }
  }

  return (
    <>
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
        variant={variant}
        size={size}
        disabled={disabled || pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? <Loader2 className="animate-spin" /> : <FileUp />}
        {pending ? "Membaca dokumen…" : label}
      </Button>
    </>
  );
}
