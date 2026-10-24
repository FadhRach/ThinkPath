import { Pencil } from "lucide-react";
import Link from "next/link";

import { BackLink } from "@/components/shared/BackLink";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AssignmentSummary } from "@/features/assignments/components/AssignmentSummary";
import { SubmissionTable } from "@/features/submissions/components/SubmissionTable";
import type { AssignmentSummary as AssignmentSummaryData, SubmissionRow } from "@/lib/types";

interface TeacherAssignmentDetailProps {
  classId: string;
  assignment: AssignmentSummaryData;
  submissions: SubmissionRow[];
  /** Saring awal daftar pengumpulan; "needs_review" hanya berlaku bila memang ada yang menunggu. */
  filter?: string;
}

/** Satu tugas di halaman kelas dosen: ringkasan, instruksi, dan tabel pengumpulan mahasiswa. */
export function TeacherAssignmentDetail({
  classId,
  assignment,
  submissions,
  filter,
}: TeacherAssignmentDetailProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink href={`/dashboard/classes/${classId}?tab=tugas`} label="Semua tugas kelas" />
        <Button asChild variant="outline">
          <Link href={`/dashboard/classes/${classId}/assignments/${assignment.id}/edit`}>
            <Pencil /> Edit tugas
          </Link>
        </Button>
      </div>
      <AssignmentSummary assignment={assignment} />
      {assignment.instructions ? (
        <Card className="p-5">
          <h2 className="text-sm font-bold">Instruksi tugas</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {assignment.instructions}
          </p>
        </Card>
      ) : null}
      <div>
        <h2 className="mb-3 text-heading font-semibold">Pengumpulan mahasiswa</h2>
        <SubmissionTable
          key={assignment.id}
          submissions={submissions}
          initialFilter={
            filter === "needs_review" && assignment.needs_review_count ? "needs_review" : "all"
          }
        />
      </div>
    </div>
  );
}
