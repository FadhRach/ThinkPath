import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { AssignmentHeader } from "@/features/assignments/components/AssignmentHeader";
import { InstructionsCard } from "@/features/assignments/components/InstructionsCard";
import { ArchivedClassNotice } from "@/features/classes/components/ArchivedClassNotice";
import { StudentSubmissionPanel } from "@/features/submissions/components/StudentSubmissionPanel";
import { SubmitGuideCard } from "@/features/submissions/components/SubmitGuideCard";
import { ApiError } from "@/lib/api/errors";
import { getStudentAssignment } from "@/lib/data";

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
  const isPastDeadline =
    assignment.deadline !== null && Date.now() > new Date(assignment.deadline).getTime();
  const isReviewed = submission?.status === "reviewed";
  const isArchived = detail.class.is_archived;
  const canRevise = submission !== null && !isPastDeadline && !isArchived && !isReviewed;

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <Breadcrumb
        items={[
          { label: "Beranda", href: "/student" },
          { label: "Kelas", href: "/student/kelas" },
          { label: detail.class.name, href: `/student/kelas/${detail.class.id}` },
          { label: "Tugas" },
        ]}
      />
      <ArchivedClassNotice klass={detail.class} />
      <AssignmentHeader detail={detail} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,.6fr)]">
        <div className="space-y-4">
          <InstructionsCard instructions={assignment.instructions} />
          <StudentSubmissionPanel
            submission={submission}
            draft={draft}
            canRevise={canRevise}
            isPastDeadline={isPastDeadline}
            isArchived={isArchived}
            isReviewed={Boolean(isReviewed)}
            assignmentId={assignment.id}
            allowUpload={assignment.allow_file_upload}
            classId={detail.class.id}
          />
        </div>
        <aside className="space-y-4">
          <SubmitGuideCard targetLevel={assignment.expected_bloom_level} />
        </aside>
      </div>
    </div>
  );
}
