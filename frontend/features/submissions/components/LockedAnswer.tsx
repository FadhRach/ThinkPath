import { Lock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { richToPlain } from "@/features/editor/lib/rich-text";
import { LazyRichContent } from "@/features/editor/components/LazyEditors";
import { OriginalDocumentButton } from "@/features/submissions/components/OriginalDocumentButton";
import type { RichDoc } from "@/lib/types";

interface LockedAnswerProps {
  title: string;
  reason: string;
  rich: RichDoc | null;
  text: string;
  /** Jalur berkas asli bila jawaban diimpor dari dokumen. */
  documentPath?: string;
}

/** Jawaban yang tidak bisa diubah lagi (sudah dinilai, tenggat lewat, atau draf tersisa). */
export function LockedAnswer({ title, reason, rich, text, documentPath }: LockedAnswerProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-5 py-3">
        <h2 className="font-bold text-foreground">{title}</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          {reason}
        </span>
      </div>
      <div className="px-5 py-4 sm:px-6">
        {documentPath ? (
          <div className="mb-3">
            <OriginalDocumentButton path={documentPath} label="Lihat berkas yang diunggah" />
          </div>
        ) : null}
        {documentPath && !(rich && richToPlain(rich).trim()) ? (
          <p className="text-sm text-muted-foreground">Jawabanmu berupa dokumen yang diunggah.</p>
        ) : rich ? (
          <LazyRichContent doc={rich} />
        ) : (
          <p className="whitespace-pre-wrap leading-7 text-foreground">{text}</p>
        )}
      </div>
    </Card>
  );
}
