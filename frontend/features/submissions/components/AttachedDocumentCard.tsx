import { FileCheck2, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { OriginalDocumentButton } from "@/features/submissions/components/OriginalDocumentButton";
import type { DocumentReadMethod } from "@/lib/mutations";

const READ_METHOD_LABEL: Record<DocumentReadMethod, string> = {
  text: "dibaca langsung dari berkas",
  ocr: "dibaca dari gambar dengan OCR",
  mixed: "sebagian dibaca langsung, sebagian dari gambar dengan OCR",
};

interface AttachedDocumentCardProps {
  assignmentId: string;
  documentId: string;
  filename: string | null;
  method: DocumentReadMethod | null;
  warnings: string[];
  /** Jumlah kata hasil baca; null bila dokumen berasal dari draf lama. */
  words: number | null;
  /** Tombol ganti dokumen (pemilih berkas milik induk). */
  replace: ReactNode;
  onRemove: () => void;
  disabled?: boolean;
}

/** Dokumen yang menjadi jawaban. Teks hasil bacanya digabung dengan tulisan di kotak jawaban. */
export function AttachedDocumentCard({
  assignmentId,
  documentId,
  filename,
  method,
  warnings,
  words,
  replace,
  onRemove,
  disabled,
}: AttachedDocumentCardProps) {
  return (
    <Card className="space-y-3 border-success/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={FileCheck2} tone="success" size="sm" />
          <div className="min-w-0">
            <h2 className="break-words font-bold text-foreground">
              {filename ?? "Dokumen terlampir"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {method ? `Teks ${READ_METHOD_LABEL[method]}. ` : ""}
              {words !== null ? `${words} kata terbaca.` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <OriginalDocumentButton
            path={`/api/assignments/${assignmentId}/documents/${documentId}`}
            label="Lihat dokumen"
          />
          {replace}
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
            <Trash2 /> Lepas
          </Button>
        </div>
      </div>
      {warnings.map((warning) => (
        <Alert key={warning} variant="warning" title="Perhatikan">
          {warning}
        </Alert>
      ))}
    </Card>
  );
}
