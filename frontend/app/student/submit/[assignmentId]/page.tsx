import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { AssignmentHeader } from "@/features/assignments/components/AssignmentHeader";
import { ArchivedClassNotice } from "@/features/classes/components/ArchivedClassNotice";
import { AnswerPanel } from "@/features/submissions/components/AnswerPanel";
import { SubmissionStatusCard } from "@/features/submissions/components/SubmissionStatusCard";
import { TeacherFeedbackCard } from "@/features/submissions/components/TeacherFeedbackCard";
import { ApiError } from "@/lib/api/errors";
import { getOwnProgress, getStudentAssignment } from "@/lib/data";

export default async function SubmitAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  let detail;
  try {
    detail = await getStudentAssignment(assignmentId);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const { assignment, submission, draft } = detail;
  const isReviewed = submission?.status === "reviewed";

  // Level hasil jawaban hanya dibutuhkan setelah dinilai; kegagalannya tidak boleh merobohkan halaman.
  const achievedLevel = isReviewed
    ? ((await getOwnProgress().catch(() => null))?.classes
        .find((series) => series.class_id === detail.class.id)
        ?.points.find((point) => point.submission_id === submission.id)?.level ?? null)
    : null;

  const isPastDeadline =
    assignment.deadline !== null && Date.now() > new Date(assignment.deadline).getTime();

  return (
    <div className="space-y-5 sm:space-y-6">
      <Breadcrumb
        items={[
          { label: "Tugas", href: "/student/tugas" },
          { label: detail.class.name, href: `/student/kelas/${detail.class.id}` },
          { label: assignment.title },
        ]}
      />
      <ArchivedClassNotice klass={detail.class} />
      <AssignmentHeader detail={detail} achievedLevel={achievedLevel} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-5">
          {isReviewed && submission ? (
            <TeacherFeedbackCard feedback={submission.teacher_feedback} grade={submission.grade} />
          ) : null}
          <AnswerPanel
            assignmentId={assignment.id}
            deadline={assignment.deadline}
            submission={submission}
            draft={draft}
            allowUpload={assignment.allow_file_upload}
            isPastDeadline={isPastDeadline}
            isArchived={detail.class.is_archived}
            isReviewed={Boolean(isReviewed)}
          />
        </div>
        <aside className="space-y-4 xl:sticky xl:top-24">
          <SubmissionStatusCard submission={submission} draft={draft} />
        </aside>
      </div>
    </div>
  );
}
