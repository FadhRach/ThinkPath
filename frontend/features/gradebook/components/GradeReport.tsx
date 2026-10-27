import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/formatting";
import type { StudentClassWithAssignments } from "@/lib/types";

/** Rapor nilai satu kelas: tiap tugas dengan statusnya, nilai, dan umpan balik dosen. */
export function GradeReport({ studentClass }: { studentClass: StudentClassWithAssignments }) {
  if (!studentClass.assignments.length) {
    return (
      <EmptyState
        title="Belum ada tugas di kelas ini"
        caption="Daftar nilai terisi setelah dosen membuat tugas dan memeriksa jawabanmu."
      />
    );
  }

  return (
    <Card className="divide-y divide-border/70 overflow-hidden">
      {studentClass.assignments.map((assignment) => {
        const submission = assignment.submission;
        const graded = submission?.status === "reviewed" && typeof submission.grade === "number";
        return (
          <article key={assignment.id} className="flex gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <Link
                href={`/student/submit/${assignment.id}`}
                className="font-semibold text-foreground hover:text-brand-ink hover:underline"
              >
                {assignment.title}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {graded ? (
                  <Badge tone="success">Dinilai</Badge>
                ) : submission?.status === "submitted" ? (
                  <Badge tone="warning">Menunggu nilai</Badge>
                ) : (
                  <Badge tone="neutral">Belum dikumpulkan</Badge>
                )}
                {submission?.submitted_at ? (
                  <span>Dikumpulkan {formatDate(submission.submitted_at)}</span>
                ) : assignment.deadline ? (
                  <span>Tenggat {formatDate(assignment.deadline)}</span>
                ) : null}
              </div>
              {graded && submission.teacher_feedback ? (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
                  <span className="font-semibold">Umpan balik dosen: </span>
                  {submission.teacher_feedback}
                </p>
              ) : null}
            </div>
            <p className="shrink-0 text-right text-2xl font-bold tabular-nums text-foreground">
              {graded ? submission.grade : "–"}
              {graded ? (
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">/100</span>
              ) : null}
            </p>
          </article>
        );
      })}
    </Card>
  );
}
