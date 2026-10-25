import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { StudentTaskRow } from "@/features/assignments/lib/student-tasks";
import { ClassChip } from "@/features/classes/components/ClassChip";
import { formatDate, formatRelativeTime } from "@/lib/formatting";

/** Satu baris ringkas untuk tugas yang sudah dikumpulkan: judul, kelas, kapan, dan nilainya bila ada. */
export function StudentTaskCompactRow({ row }: { row: StudentTaskRow }) {
  const submission = row.submission;
  const grade = submission?.status === "reviewed" ? submission.grade : null;

  return (
    <Link
      href={`/student/submit/${row.assignmentId}`}
      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{row.title}</p>
        <ClassChip name={row.className} className="mt-0.5" />
      </div>
      <p className="hidden shrink-0 text-xs text-muted-foreground sm:block">
        {submission?.submitted_at
          ? `Dikumpulkan ${formatRelativeTime(submission.submitted_at)}`
          : row.deadline
            ? `Tenggat ${formatDate(row.deadline)}`
            : ""}
      </p>
      {grade !== null && grade !== undefined ? (
        <Badge tone="success" size="md" className="shrink-0 tabular-nums">
          Nilai {grade}
        </Badge>
      ) : (
        <Badge tone="warning" size="md" className="hidden shrink-0 sm:inline-flex">
          Menunggu nilai
        </Badge>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
