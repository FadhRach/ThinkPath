"use client";

import { FileUp } from "lucide-react";
import { useRef } from "react";

import { ToolbarButton } from "@/features/editor/components/ToolbarButton";
import { uploadDocument, type DocumentImportResult } from "@/lib/mutations";
import { getApiErrorMessage } from "@/lib/api/messages";

const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg";
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  assignmentId: string;
  onImported: (result: DocumentImportResult, filename: string) => void;
  onError: (message: string) => void;
  onPending: (pending: boolean) => void;
  disabled?: boolean;
}

/** Tombol toolbar: pilih berkas, kirim ke backend, lalu serahkan teks hasilnya ke editor. */
export function DocumentUploadField({
  assignmentId,
  onImported,
  onError,
  onPending,
  disabled,
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
      <ToolbarButton
        icon={FileUp}
        label="Impor dokumen (PDF, DOCX, gambar)"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      />
    </>
  );
}
