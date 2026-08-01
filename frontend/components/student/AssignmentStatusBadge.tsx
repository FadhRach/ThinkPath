import type { StudentSubmissionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const BASE = "inline-flex items-center rounded-full px-3 py-1 text-body-sm font-semibold";

export function AssignmentStatusBadge({
  submission,
}: {
  submission: StudentSubmissionStatus | null;
}) {
  if (submission === null) {
    return (
      <span className={cn(BASE, "bg-muted text-muted-foreground")}>
        Belum dikerjakan
      </span>
    );
  }
  if (submission.status === "reviewed" && submission.grade !== null) {
    return (
      <span className={cn(BASE, "bg-success-soft text-success")}>
        Dinilai · {submission.grade}
      </span>
    );
  }
  return (
    <span className={cn(BASE, "bg-secondary text-secondary-foreground")}>
      Terkumpul
    </span>
  );
}
