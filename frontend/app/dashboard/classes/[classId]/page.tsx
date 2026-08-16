import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink } from "@/components/common/BackLink";
import { PageHeader } from "@/components/common/PageHeader";
import { AssignmentSelector } from "@/components/dashboard/AssignmentSelector";
import { AssignmentSummary } from "@/components/dashboard/AssignmentSummary";
import { CreateLinkChip } from "@/components/dashboard/CreateLinkChip";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmissionTable } from "@/components/dashboard/SubmissionTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
      <BackLink href="/dashboard/classes" label="Kembali ke daftar kelas" />

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
        // Suspense membuat fetch submissions di-stream: kartu kelas tampil
        // dulu, tabel menyusul — bukan halaman kosong menunggu semuanya.
        <Suspense
          fallback={
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          }
        >
          <ClassAssignments
            classId={currentClass.id}
            assignments={assignments}
            selectedAssignmentId={searchParams.assignment}
            newAssignmentHref={newAssignmentHref}
          />
        </Suspense>
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
  // Tanpa pilihan eksplisit, jatuh ke tugas terbaru yang sudah punya
  // pengumpulan. Membuka kelas langsung pada tugas yang baru dibuat hanya
  // menampilkan layar kosong, padahal yang dicari dosen adalah bukti.
  const selectedAssignment =
    assignments.find((assignment) => assignment.id === selectedAssignmentId) ??
    assignments.find((assignment) => assignment.submission_count > 0) ??
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
