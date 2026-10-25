import { Alert } from "@/components/ui/alert";
import { docFrom } from "@/features/editor/lib/rich-text";
import { AnswerEditor } from "@/features/submissions/components/AnswerEditor";
import { LockedAnswer } from "@/features/submissions/components/LockedAnswer";
import type { AnswerDraft, StudentSubmissionWithText } from "@/lib/types";

interface AnswerPanelProps {
  assignmentId: string;
  deadline: string | null;
  submission: StudentSubmissionWithText | null;
  draft: AnswerDraft | null;
  allowUpload: boolean;
  isPastDeadline: boolean;
  isArchived: boolean;
  isReviewed: boolean;
}

/**
 * Isi utama halaman tugas. Salah satu dari: kelas arsip, tenggat lewat (tanpa jawaban atau dengan
 * draf), editor jawaban pertama, editor revisi, atau jawaban terkunci (dinilai / tenggat lewat).
 */
export function AnswerPanel({
  assignmentId,
  deadline,
  submission,
  draft,
  allowUpload,
  isPastDeadline,
  isArchived,
  isReviewed,
}: AnswerPanelProps) {
  if (submission === null) {
    if (isArchived) {
      return (
        <Alert variant="danger" title="Kelas sudah diarsipkan">
          Dosen kelas ini telah menghapus akunnya, jadi tugas ini tidak lagi menerima jawaban.
        </Alert>
      );
    }
    if (isPastDeadline) {
      return (
        <div className="space-y-4">
          <Alert variant="danger" title="Tenggat sudah berakhir">
            Tugas ini tidak lagi menerima jawaban karena tenggatnya telah lewat.
          </Alert>
          {draft ? (
            <LockedAnswer
              title="Tulisan yang sempat tersimpan"
              reason="Tidak bisa dikumpulkan"
              rich={draft.rich_answer}
              text={draft.text_answer}
            />
          ) : null}
        </div>
      );
    }
    return (
      <AnswerEditor
        assignmentId={assignmentId}
        deadline={deadline}
        allowUpload={allowUpload}
        initialDoc={docFrom(draft?.rich_answer, draft?.text_answer ?? "")}
        initialDocumentId={draft?.document_id ?? null}
      />
    );
  }

  const canRevise = !isPastDeadline && !isArchived && !isReviewed;
  if (canRevise) {
    return (
      <AnswerEditor
        assignmentId={assignmentId}
        deadline={deadline}
        allowUpload={allowUpload}
        mode="revise"
        initialDoc={docFrom(
          submission.rich_answer,
          submission.is_imported ? "" : submission.text_answer,
        )}
        initialDocumentId={submission.document_id}
      />
    );
  }

  return (
    <LockedAnswer
      title="Jawabanmu"
      reason={
        isReviewed
          ? "Sudah dinilai, tidak bisa direvisi lagi"
          : isArchived
            ? "Kelas diarsipkan"
            : "Tenggat berakhir, jawaban terkunci"
      }
      rich={submission.rich_answer}
      text={submission.text_answer}
      documentPath={
        submission.is_imported ? `/api/submissions/${submission.id}/document` : undefined
      }
    />
  );
}
