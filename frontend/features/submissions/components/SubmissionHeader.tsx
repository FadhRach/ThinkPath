import { FileUp } from "lucide-react";

import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { bloomCode } from "@/features/bloom/lib/bloom";
import { academicLabel } from "@/features/classes/lib/academic";
import { AiBandBadge } from "@/features/submissions/components/AiBandBadge";
import { OriginalDocumentButton } from "@/features/submissions/components/OriginalDocumentButton";
import { submissionStatusMeta } from "@/features/submissions/lib/status";
import { countWords } from "@/lib/text";
import type { SubmissionDetail } from "@/lib/types";

/** Kepala halaman detail pengumpulan: siapa, tugas apa, dan lencana ringkas statusnya. */
export function SubmissionHeader({ detail }: { detail: SubmissionDetail }) {
  const analysis = detail.analysis;
  const isFlagged = analysis?.ai_band === "high";
  const status = submissionStatusMeta(detail.status);

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <AvatarInitials name={detail.student.display_name} size="lg" />
        <div className="min-w-0 space-y-0.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-display-2">
            {detail.student.display_name}
          </h1>
          <p className="text-body font-medium text-foreground">{detail.assignment.title}</p>
          <p className="text-body-sm text-muted-foreground">
            {academicLabel(detail.assignment)} &middot; Target{" "}
            {bloomCode(detail.assignment.expected_bloom_level)} &middot;{" "}
            {countWords(detail.text_answer)} kata
            {detail.grade !== null ? ` · Nilai ${detail.grade}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Indikasi ringkas; rincian tersedia pada bagian analisis. */}
        {analysis ? (
          <AiBandBadge
            band={analysis.ai_band}
            suffix={String(analysis.ai_score)}
            size="md"
            className="lg:hidden"
          />
        ) : null}
        {isFlagged ? <AiBandBadge band="high" size="md" className="hidden lg:inline-flex" /> : null}
        {detail.is_imported ? (
          <Badge
            tone="neutral"
            size="md"
            title="Jawaban berasal dari dokumen unggahan, jadi forensik proses tidak dinilai."
          >
            <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
            Diimpor dari dokumen
          </Badge>
        ) : null}
        {detail.is_imported ? (
          <OriginalDocumentButton path={`/api/submissions/${detail.id}/document`} />
        ) : null}
        <Badge tone={status.tone} size="md">
          {status.label}
        </Badge>
      </div>
    </Card>
  );
}
