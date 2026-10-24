import { ArrowRight, CalendarClock, ClipboardList } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { AssignmentStatusBadge } from "@/features/assignments/components/AssignmentStatusBadge";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { StudentClassWithAssignments } from "@/lib/types";

export function StudentClassAssignments({
  assignments,
}: {
  assignments: StudentClassWithAssignments["assignments"];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/80 px-5 py-4 sm:px-6">
        <h2 className="text-heading font-semibold text-foreground">Tugas kelas</h2>
        <Button asChild variant="link" size="sm">
          <Link href="/student/tugas">
            Semua tugas <ArrowRight />
          </Link>
        </Button>
      </div>
      {assignments.length ? (
        <ul className="divide-y divide-border/70">
          {assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="flex min-w-0 items-start gap-3">
                <IconTile icon={ClipboardList} size="sm" className="mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground">{assignment.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                    {assignment.deadline
                      ? `Tenggat ${formatDate(assignment.deadline)} · ${formatRelativeTime(assignment.deadline)}`
                      : "Tanpa tenggat"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pl-12 sm:justify-end sm:pl-0">
                <AssignmentStatusBadge submission={assignment.submission} />
                <Button asChild variant="ghost" size="sm" className="text-brand-ink">
                  <Link href={`/student/submit/${assignment.id}`}>
                    Detail <ArrowRight />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          variant="inline"
          title="Belum ada tugas"
          caption="Tugas yang diberikan dosen akan muncul di bagian ini."
        />
      )}
    </Card>
  );
}
