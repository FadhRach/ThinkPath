import { Badge } from "@/components/ui/badge";
import type { StudentSubmissionStatus } from "@/lib/types";

export function AssignmentStatusBadge({
  submission,
}: {
  submission: StudentSubmissionStatus | null;
}) {
  if (submission === null) return <Badge tone="neutral">Belum dikerjakan</Badge>;
  if (submission.status === "reviewed" && submission.grade !== null) {
    return <Badge tone="success">Dinilai · {submission.grade}</Badge>;
  }
  return <Badge tone="brand">Terkumpul</Badge>;
}
