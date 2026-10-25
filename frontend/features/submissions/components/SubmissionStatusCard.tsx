import { History, PenLine, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { AssignmentStatusBadge } from "@/features/assignments/components/AssignmentStatusBadge";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { AnswerDraft, StudentSubmissionWithText } from "@/lib/types";

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-brand-ink" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{children}</p>
      </div>
    </div>
  );
}

/** Status pengumpulan dan riwayat perubahan; menggantikan kartu "cara mengumpulkan". */
export function SubmissionStatusCard({
  submission,
  draft,
}: {
  submission: StudentSubmissionWithText | null;
  draft: AnswerDraft | null;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-foreground">Status pengumpulan</h2>
        <AssignmentStatusBadge submission={submission} />
      </div>
      <div className="mt-2 divide-y divide-border/70">
        {submission ? (
          <>
            <Row icon={<PenLine className="h-4 w-4" />} label="Terakhir dikumpulkan">
              {formatRelativeTime(submission.submitted_at)}
              <span className="block text-xs font-normal text-muted-foreground">
                {formatDate(submission.submitted_at)}
              </span>
            </Row>
            <Row icon={<RefreshCw className="h-4 w-4" />} label="Perubahan">
              {submission.revision_count === 0
                ? "Belum pernah direvisi"
                : `Direvisi ${submission.revision_count} kali`}
            </Row>
            {submission.is_imported ? (
              <Row icon={<History className="h-4 w-4" />} label="Sumber jawaban">
                Diimpor dari dokumen
              </Row>
            ) : null}
          </>
        ) : (
          <Row icon={<PenLine className="h-4 w-4" />} label="Draf tulisan">
            {draft ? `Tersimpan ${formatRelativeTime(draft.saved_at)}` : "Disimpan otomatis"}
            <span className="block text-xs font-normal text-muted-foreground">
              Setiap perubahan tersimpan selagi kamu mengetik; kumpulkan bila sudah siap.
            </span>
          </Row>
        )}
      </div>
    </Card>
  );
}
