import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/common/PageHeader";
import { AssignmentSelector } from "@/components/dashboard/AssignmentSelector";
import { AssignmentSummary } from "@/components/dashboard/AssignmentSummary";
import { CreateLinkChip } from "@/components/dashboard/CreateLinkChip";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmissionTable } from "@/components/dashboard/SubmissionTable";
import { Button } from "@/components/ui/button";
import { getAssignments, getClasses, getSubmissions } from "@/lib/data";
import { academicLabel } from "@/lib/academic";

interface SearchParams {
  assignment?: string;
}

export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: { classId: string };
  searchParams: SearchParams;
}) {
  const [classes, assignments] = await Promise.all([
    getClasses(),
    getAssignments(params.classId),
  ]);

  const currentClass = classes.find((cls) => cls.id === params.classId);
  if (!currentClass) {
    notFound();
  }

  const newAssignmentHref = `/dashboard/classes/${currentClass.id}/assignments/new`;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke daftar kelas
      </Link>

      <PageHeader
        title={currentClass.name}
        subtitle={`${currentClass.subject} · ${academicLabel(currentClass)}`}
        actions={
          <span className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
            Kode kelas:
            <span className="rounded-lg border border-primary bg-secondary px-3 py-1 font-mono font-semibold tracking-wider text-primary">
              {currentClass.join_code}
            </span>
          </span>
        }
      />

      {assignments.length === 0 ? (
        <EmptyState
          title="Belum ada tugas di kelas ini"
          caption="Setelah kamu membuat tugas, hasil pengumpulan mahasiswa akan muncul di sini lengkap dengan rangkuman bukti."
          action={
            <Button asChild>
              <Link href={newAssignmentHref}>Buat tugas</Link>
            </Button>
          }
        />
      ) : (
        <ClassAssignments
          classId={currentClass.id}
          assignments={assignments}
          selectedAssignmentId={searchParams.assignment}
          newAssignmentHref={newAssignmentHref}
        />
      )}
    </div>
  );
}

async function ClassAssignments({
  classId,
  assignments,
  selectedAssignmentId,
  newAssignmentHref,
}: {
  classId: string;
  assignments: Awaited<ReturnType<typeof getAssignments>>;
  selectedAssignmentId?: string;
  newAssignmentHref: string;
}) {
  const selectedAssignment =
    assignments.find((assignment) => assignment.id === selectedAssignmentId) ??
    assignments[0];
  const submissions = await getSubmissions(selectedAssignment.id);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <AssignmentSelector
          classId={classId}
          assignments={assignments}
          selectedAssignmentId={selectedAssignment.id}
        />
        <CreateLinkChip href={newAssignmentHref} label="Buat tugas" />
      </div>

      <AssignmentSummary assignment={selectedAssignment} />

      {submissions.length === 0 ? (
        <EmptyState
          title="Belum ada pengumpulan"
          caption="Mahasiswa belum mengumpulkan tugas ini. Begitu mereka submit, tabel bukti akan terisi otomatis."
        />
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Submission Terbaru</h2>
          <SubmissionTable submissions={submissions} />
        </div>
      )}
    </>
  );
}
