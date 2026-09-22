"use client";

import { upload } from "@vercel/blob/client";
import { FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/common/Callout";
import { extractDocument } from "@/lib/mutations";
import { ApiError, getApiErrorMessage } from "@/lib/api-shared";
import type { ImportMetadata } from "@/lib/types";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp";

type Status = "idle" | "uploading" | "extracting" | "error";

interface Props {
  assignmentId: string;
  disabled?: boolean;
  onExtracted: (text: string, meta: ImportMetadata) => void;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export function DocumentUploadField({ assignmentId, disabled, onExtracted }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setWarnings([]);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Jenis berkas tidak didukung. Unggah PDF, PNG, JPEG, atau WEBP.");
      setStatus("error");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("Berkas melebihi 15 MB.");
      setStatus("error");
      return;
    }

    try {
      setStatus("uploading");
      const blob = await upload(
        `submissions/${assignmentId}/${Date.now()}-${sanitizeFilename(file.name)}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/blob/upload-token",
          clientPayload: JSON.stringify({ assignmentId }),
        },
      );

      setStatus("extracting");
      const result = await extractDocument(assignmentId, {
        blob_url: blob.url,
        content_type: file.type,
        filename: file.name,
      });

      setWarnings(result.warnings);
      setStatus("idle");
      onExtracted(result.text, {
        filename: file.name,
        page_count: result.page_count,
        extraction_method: result.extraction_method,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        // Gagal di langkah ekstraksi (Django) - sudah punya pesan Indonesia siap pakai.
        setError(
          getApiErrorMessage(err, "Gagal membaca dokumen. Coba unggah ulang atau ketik jawabanmu langsung."),
        );
      } else if (err instanceof Error) {
        // Gagal di langkah unggah Blob (mis. token belum dikonfigurasi, BlobError
        // dari @vercel/blob). Pesan aslinya ditampilkan apa adanya - menelan
        // pesan ini di balik teks generik membuat kegagalan konfigurasi
        // (BLOB_READ_WRITE_TOKEN kosong, dll) tidak mungkin didiagnosis dari UI.
        setError(`Gagal mengunggah berkas: ${err.message}`);
      } else {
        setError("Gagal mengunggah berkas. Periksa koneksi lalu coba lagi.");
      }
      setStatus("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const busy = status === "uploading" || status === "extracting";

  return (
    <div className="space-y-3">
      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          id="document-upload-input"
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {status === "uploading"
            ? "Mengunggah..."
            : status === "extracting"
              ? "Membaca dokumen..."
              : "Unggah dokumen (PDF/gambar)"}
        </Button>
      </div>

      {warnings.length > 0 ? (
        <Callout variant="warning" title="Periksa kembali hasilnya">
          <ul className="list-disc space-y-1 pl-4">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
