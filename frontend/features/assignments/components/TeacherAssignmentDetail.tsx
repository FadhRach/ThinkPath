import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InstructionText } from "@/features/assignments/components/InstructionText";
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
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/classes/${classId}?tab=tugas`}>
            <ArrowLeft /> Semua tugas kelas
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/dashboard/classes/${classId}/assignments/${assignment.id}/edit`}>
            <Pencil /> Edit tugas
          </Link>
        </Button>
      </div>
      <AssignmentSummary assignment={assignment} />
      {assignment.instructions || assignment.instructions_rich ? (
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-bold">Instruksi tugas</h2>
          <InstructionText text={assignment.instructions} rich={assignment.instructions_rich} />
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
