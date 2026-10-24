import { CheckCircle2, MessageSquareText } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { AssignmentStatusBadge } from "@/features/assignments/components/AssignmentStatusBadge";
import { OriginalDocumentButton } from "@/features/submissions/components/OriginalDocumentButton";
import { SubmitAnswerForm } from "@/features/submissions/components/SubmitAnswerForm";
import { formatRelativeTime } from "@/lib/formatting";
import type { AnswerDraft, StudentSubmissionWithText } from "@/lib/types";

/**
 * Isi utama halaman tugas mahasiswa. Satu dari lima keadaan: kelas diarsipkan, tenggat
 * lewat tanpa jawaban, belum mengumpulkan, bisa merevisi, atau terkunci (dinilai/lewat tenggat).
 */
export function StudentSubmissionPanel({
  submission,
  canRevise,
  isPastDeadline,
  isArchived,
  isReviewed,
  assignmentId,
  allowUpload,
  classId,
  draft,
}: {
  draft: AnswerDraft | null;
  submission: StudentSubmissionWithText | null;
  canRevise: boolean;
  isPastDeadline: boolean;
  isArchived: boolean;
  isReviewed: boolean;
  assignmentId: string;
  allowUpload: boolean;
  classId: string;
}) {
  if (submission === null && isArchived) {
    return (
      <Alert variant="danger" title="Kelas sudah diarsipkan">
        Dosen kelas ini telah menghapus akunnya, jadi tugas ini tidak lagi menerima jawaban.
      </Alert>
    );
  }

  if (submission === null && isPastDeadline) {
    return (
      <Alert variant="danger" title="Tenggat sudah berakhir">
        Tugas ini tidak lagi menerima jawaban karena tenggatnya telah lewat.
      </Alert>
    );
  }

  if (submission === null) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <IconTile icon={MessageSquareText} size="sm" />
          <h2 className="font-bold text-foreground">Kumpulkan tugasmu</h2>
        </div>
        <SubmitAnswerForm
          assignmentId={assignmentId}
          backHref={`/student/kelas/${classId}`}
          allowUpload={allowUpload}
          initialText={draft?.text_answer ?? ""}
          initialDocumentId={draft?.document_id ?? null}
        />
      </Card>
    );
  }

  if (canRevise) {
    return (
      <div className="space-y-3">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="mt-1 text-sm font-bold text-foreground">Jawabanmu sudah diterima</p>
            </div>
            <AssignmentStatusBadge submission={submission} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Dikumpulkan {formatRelativeTime(submission.submitted_at)}. Kamu masih bisa memperbaiki
            jawaban sebelum tenggat.
          </p>
          {submission.is_imported ? (
            <div className="mt-3">
              <OriginalDocumentButton
                path={`/api/submissions/${submission.id}/document`}
                label="Lihat berkas yang diunggah"
              />
            </div>
          ) : null}
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="mb-4 text-sm font-bold text-foreground">Perbarui jawaban</p>
          <SubmitAnswerForm
            assignmentId={assignmentId}
            backHref={`/student/kelas/${classId}`}
            mode="revise"
            initialText={submission.text_answer}
            allowUpload={allowUpload}
          />
        </Card>
      </div>
    );
  }

  const lockReason = isReviewed
    ? "Jawaban sudah dinilai dosen, jadi tidak bisa direvisi lagi."
    : "Tenggat sudah berakhir, jawaban terkunci.";
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="mt-1 text-sm font-bold text-foreground">Jawabanmu telah dikirim</p>
        </div>
        <AssignmentStatusBadge submission={submission} />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Dikumpulkan {formatRelativeTime(submission.submitted_at)}. {lockReason}
      </p>
      <div className="border-t border-border pt-4">
        <p className="mb-2 text-sm font-bold text-foreground">Jawabanmu</p>
        {submission.is_imported ? (
          <div className="mb-3">
            <OriginalDocumentButton
              path={`/api/submissions/${submission.id}/document`}
              label="Lihat berkas yang diunggah"
            />
          </div>
        ) : null}
        <p className="whitespace-pre-wrap rounded-xl bg-background p-4 text-sm leading-7 text-foreground">
          {submission.text_answer}
        </p>
      </div>
      {isReviewed ? (
        <div className="rounded-xl bg-accent p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-accent-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Nilai: {submission.grade ?? "-"}
          </p>
          {submission.teacher_feedback ? (
            <p className="mt-2 border-t border-border pt-2 text-sm leading-relaxed text-foreground">
              <strong>Umpan balik dosen:</strong> {submission.teacher_feedback}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Belum ada catatan umpan balik dari dosen.
            </p>
          )}
        </div>
      ) : (
        <Alert variant="info" title="Menunggu penilaian">
          Jawabanmu sudah diterima. Nilai dan umpan balik dosen akan tampil di bagian ini.
        </Alert>
      )}
    </Card>
  );
}
