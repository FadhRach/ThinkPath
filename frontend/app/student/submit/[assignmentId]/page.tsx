import { notFound } from "next/navigation";

import { BackLink } from "@/components/common/BackLink";
import { BloomStepper } from "@/components/common/BloomStepper";
import { Callout } from "@/components/common/Callout";
import { SubjectTag } from "@/components/common/SubjectTag";
import { AssignmentStatusBadge } from "@/components/student/AssignmentStatusBadge";
import { SubmitAnswerForm } from "@/components/student/SubmitAnswerForm";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { bloomCode } from "@/lib/bloom";
import { getStudentAssignment } from "@/lib/data";
import { formatRelativeTime } from "@/lib/formatting";
import type { StudentSubmissionWithText } from "@/lib/types";

export default async function SubmitAssignmentPage({
  params,
}: {
  params: { assignmentId: string };
}) {
  let detail;
  try {
    detail = await getStudentAssignment(params.assignmentId);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      notFound();
    }
    throw error;
  }

  const { assignment, submission } = detail;
  const isPastDeadline =
    assignment.deadline !== null && Date.now() > new Date(assignment.deadline).getTime();
  const isReviewed = submission?.status === "reviewed";
  const canRevise = submission !== null && !isPastDeadline && !isReviewed;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/student" label="Kembali ke beranda" />

      <div className="space-y-2">
        <SubjectTag
          subject={detail.class.subject}
          meta={`${detail.class.name}${
            assignment.deadline ? ` · Tenggat ${formatRelativeTime(assignment.deadline)}` : ""
          }`}
        />
        <h1 className="text-display-2 font-extrabold tracking-tight text-foreground">
          {assignment.title}
        </h1>
      </div>

      {assignment.instructions ? (
        <Callout variant="info" title="Pertanyaan">
          <p className="text-foreground">{assignment.instructions}</p>
        </Callout>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-soft">
        <div>
          <p className="text-body-sm font-semibold text-foreground">
            Target level kognitif
          </p>
          <p className="text-body-sm text-muted-foreground">
            Jawaban dianalisis untuk level {bloomCode(assignment.expected_bloom_level)}.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <BloomStepper targetLevel={assignment.expected_bloom_level} />
        </div>
      </Card>

      {renderSubmissionSection({
        submission,
        canRevise,
        isPastDeadline,
        isReviewed,
        assignmentId: assignment.id,
      })}
    </div>
  );
}

interface SectionProps {
  submission: StudentSubmissionWithText | null;
  canRevise: boolean;
  isPastDeadline: boolean;
  isReviewed: boolean;
  assignmentId: string;
}

function renderSubmissionSection({
  submission,
  canRevise,
  isPastDeadline,
  isReviewed,
  assignmentId,
}: SectionProps) {
  if (submission === null) {
    if (isPastDeadline) {
      return (
        <Callout variant="danger" title="Tenggat berakhir">
          <p>Tenggat tugas ini sudah lewat dan kamu belum mengumpulkan jawaban.</p>
        </Callout>
      );
    }
    return <SubmitAnswerForm assignmentId={assignmentId} backHref="/student" />;
  }

  if (canRevise) {
    return (
      <div className="space-y-4">
        <Card className="space-y-2 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <p className="caption-eyebrow text-primary">Pengumpulanmu</p>
            <AssignmentStatusBadge submission={submission} />
          </div>
          <p className="text-body-sm text-muted-foreground">
            Dikumpulkan {formatRelativeTime(submission.submitted_at)}
            {submission.revision_count > 0
              ? ` · sudah direvisi ${submission.revision_count} kali`
              : ""}
            . Kamu masih bisa memperbaiki jawaban sampai tenggat berakhir.
          </p>
        </Card>
        <SubmitAnswerForm
          assignmentId={assignmentId}
          backHref="/student"
          mode="revise"
          initialText={submission.text_answer}
        />
      </div>
    );
  }

  const lockReason = isReviewed
    ? "Jawaban sudah dinilai dosen, jadi tidak bisa direvisi lagi."
    : "Tenggat sudah berakhir, jawaban terkunci.";

  return (
    <Card className="space-y-4 p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="caption-eyebrow text-primary">Pengumpulanmu</p>
        <AssignmentStatusBadge submission={submission} />
      </div>
      <p className="text-body-sm text-muted-foreground">
        Dikumpulkan {formatRelativeTime(submission.submitted_at)}
        {submission.revision_count > 0
          ? ` · direvisi ${submission.revision_count} kali`
          : ""}
        . {lockReason}
      </p>

      <div className="space-y-1.5">
        <p className="text-body-sm font-semibold text-foreground">Jawabanmu</p>
        <p className="whitespace-pre-wrap rounded-card border border-border bg-muted/40 p-4 text-body text-foreground">
          {submission.text_answer}
        </p>
      </div>

      {isReviewed && submission.grade !== null ? (
        <div className="space-y-1 border-t border-border pt-4">
          <p className="text-body font-semibold text-foreground">
            Nilai: {submission.grade}
          </p>
          {submission.teacher_feedback ? (
            <p className="text-body text-muted-foreground">
              Umpan balik dosen: {submission.teacher_feedback}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-border pt-4 text-body text-muted-foreground">
          Jawabanmu sudah diterima dan sedang menunggu penilaian dosen.
        </p>
      )}
    </Card>
  );
}
