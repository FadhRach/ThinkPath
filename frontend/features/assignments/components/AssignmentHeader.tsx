import { ArrowLeft, CalendarClock } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { AssignmentStatusBadge } from "@/features/assignments/components/AssignmentStatusBadge";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { StudentAssignmentDetail } from "@/lib/types";

/** Kepala halaman tugas untuk mahasiswa: kelas asal, judul, tenggat, dan status pengumpulan. */
export function AssignmentHeader({ detail }: { detail: StudentAssignmentDetail }) {
  const { assignment, submission } = detail;
  const classHref = `/student/kelas/${detail.class.id}`;

  return (
    <Card className="px-5 py-5 sm:px-7 sm:py-6">
      <Link
        href={classHref}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {detail.class.name}
      </Link>
      <h1 className="mt-1.5 max-w-3xl font-display text-title font-medium">{assignment.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {assignment.deadline
            ? `Tenggat ${formatDate(assignment.deadline)} · ${formatRelativeTime(assignment.deadline)}`
            : "Tanpa tenggat"}
        </span>
        <AssignmentStatusBadge submission={submission} />
      </div>
    </Card>
  );
}
