import { FileText, FileUp, NotebookPen, ScanSearch } from "lucide-react";

import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LazyRichContent } from "@/features/editor/components/LazyEditors";
import { richToPlain } from "@/features/editor/lib/rich-text";
import { OriginalDocumentButton } from "@/features/submissions/components/OriginalDocumentButton";
import { TextReview } from "@/features/submissions/components/TextReview";
import { countWords } from "@/lib/text";
import type { SubmissionDetail } from "@/lib/types";

function ReviewBadge({ detail }: { detail: SubmissionDetail }) {
  const count = detail.style_markers.spans.length;
  return count ? (
    <Badge tone={detail.style_markers.strong_total ? "warning" : "neutral"} size="sm">
      {count} sorotan
    </Badge>
  ) : null;
}

/** Jawaban dari dokumen: dokumennya tampil lebih dulu, teks hasil baca (gabungan) ada di lipatan. */
function ImportedAnswer({ detail }: { detail: SubmissionDetail }) {
  const words = countWords(detail.text_answer);
  const note =
    detail.rich_answer && richToPlain(detail.rich_answer).trim() ? detail.rich_answer : null;

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <IconTile icon={FileUp} size="sm" />
            <div>
              <h2 className="font-bold text-foreground">Dokumen mahasiswa</h2>
              <p className="text-xs text-muted-foreground">
                Dibaca sistem menjadi teks; tulisan di kotak jawaban ikut digabung.
              </p>
            </div>
          </div>
          {detail.document_available ? (
            <OriginalDocumentButton
              path={`/api/submissions/${detail.id}/document`}
              label="Buka dokumen asli"
            />
          ) : (
            <Badge tone="warning" title="Teks hasil baca masih tersimpan">
              Berkas asli tidak tersedia
            </Badge>
          )}
        </div>
        {note ? (
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" /> Ditulis mahasiswa di kotak
              jawaban
            </p>
            <LazyRichContent doc={note} />
          </div>
        ) : null}
      </Card>

      <CollapsibleSection
        title="Teks hasil baca dokumen"
        defaultOpen={false}
        summary={
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {words} kata <ReviewBadge detail={detail} />
          </span>
        }
      >
        <Card className="p-5">
          <TextReview text={detail.text_answer} markers={detail.style_markers} />
        </Card>
      </CollapsibleSection>
    </div>
  );
}

/** Jawaban yang diketik: tampilan asli sebagaimana dilihat mahasiswa, atau telaah gaya dan ritme. */
function TypedAnswer({ detail }: { detail: SubmissionDetail }) {
  const words = countWords(detail.text_answer);
  return (
    <Card className="overflow-clip">
      <Tabs defaultValue="asli">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <IconTile icon={FileText} size="sm" />
            <h2 className="font-bold text-foreground">Jawaban mahasiswa</h2>
            <span className="text-xs text-muted-foreground">{words} kata</span>
          </div>
          {detail.text_answer ? (
            <TabsList className="sm:w-fit">
              <TabsTrigger value="asli">Tampilan asli</TabsTrigger>
              <TabsTrigger value="telaah">
                <ScanSearch className="h-4 w-4" aria-hidden="true" />
                Telaah gaya &amp; ritme
                <ReviewBadge detail={detail} />
              </TabsTrigger>
            </TabsList>
          ) : null}
        </div>
        <TabsContent value="asli" className="mt-0 px-5 py-4 sm:px-6">
          {detail.rich_answer ? (
            <LazyRichContent doc={detail.rich_answer} />
          ) : detail.text_answer ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
              {detail.text_answer}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada teks jawaban.</p>
          )}
        </TabsContent>
        <TabsContent value="telaah" className="mt-0 px-5 py-4 sm:px-6">
          <TextReview text={detail.text_answer} markers={detail.style_markers} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

/** Jawaban mahasiswa untuk dosen, dalam bentuk yang sesuai asalnya (dokumen atau ketikan). */
export function AnswerCard({ detail }: { detail: SubmissionDetail }) {
  return detail.is_imported ? <ImportedAnswer detail={detail} /> : <TypedAnswer detail={detail} />;
}
