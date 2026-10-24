import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { AssignmentStatusBadge } from "@/features/assignments/components/AssignmentStatusBadge";
import { CognitiveTarget } from "@/features/assignments/components/CognitiveTarget";
import { DeadlineLabel } from "@/features/assignments/components/DeadlineLabel";
import { InstructionText } from "@/features/assignments/components/InstructionText";
import type { StudentAssignmentDetail } from "@/lib/types";

interface AssignmentHeaderProps {
  detail: StudentAssignmentDetail;
  /** Level Bloom hasil jawaban (dari grafik perkembangan), bila sudah dianalisis. */
  achievedLevel: number | null;
}

/**
 * Kepala halaman tugas: kelas asal, judul, instruksi, dan tenggat dalam satu kartu. Setelah
 * dinilai, nilai dan perbandingan target kognitif dengan hasilnya muncul di sisi kanan.
 */
export function AssignmentHeader({ detail, achievedLevel }: AssignmentHeaderProps) {
  const { assignment, submission } = detail;
  const grade = submission?.status === "reviewed" ? submission.grade : null;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <Link
              href={`/student/kelas/${detail.class.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {detail.class.name}
            </Link>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-title font-bold text-foreground">{assignment.title}</h1>
              <AssignmentStatusBadge submission={submission} />
            </div>
          </div>
          <InstructionText text={assignment.instructions} />
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-8">
            <DeadlineLabel deadline={assignment.deadline} finished={submission !== null} />
            <CognitiveTarget
              target={assignment.expected_bloom_level}
              achieved={grade !== null ? achievedLevel : null}
            />
          </div>
        </div>

        {grade !== null ? (
          <div className="shrink-0 rounded-2xl bg-success-soft px-8 py-5 text-center lg:min-w-44">
            <p className="text-xs font-semibold text-success">Nilai dari dosen</p>
            <p className="mt-1 text-5xl font-bold tabular-nums text-foreground">
              {grade}
              <span className="ml-1 text-base font-medium text-muted-foreground">/100</span>
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
