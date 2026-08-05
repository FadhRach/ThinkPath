import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { AssignmentStatusBadge } from "@/components/student/AssignmentStatusBadge";
import { Card } from "@/components/ui/card";
import { bloomCode } from "@/lib/bloom";
import { formatRelativeTime } from "@/lib/formatting";
import type { StudentClassWithAssignments } from "@/lib/types";
import { academicLabel } from "@/lib/academic";

export function StudentClassCard({
  studentClass,
}: {
  studentClass: StudentClassWithAssignments;
}) {
  return (
    <Card className="overflow-hidden shadow-soft">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">{studentClass.name}</h2>
          <p className="text-body-sm text-muted-foreground">
            {studentClass.subject} &middot; {academicLabel(studentClass)} &middot;{" "}
            {studentClass.teacher_name}
          </p>
        </div>
      </header>
      {studentClass.assignments.length === 0 ? (
        <p className="px-5 py-6 text-body text-muted-foreground">
          Belum ada tugas di kelas ini.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {studentClass.assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{assignment.title}</p>
                <p className="mt-0.5 text-body-sm text-muted-foreground">
                  Target {bloomCode(assignment.expected_bloom_level)} &middot;{" "}
                  {assignment.deadline
                    ? `Tenggat ${formatRelativeTime(assignment.deadline)}`
                    : "Tanpa tenggat"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <AssignmentStatusBadge submission={assignment.submission} />
                <Link
                  href={`/student/submit/${assignment.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-body-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  {assignment.submission === null ? "Kerjakan" : "Lihat"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
