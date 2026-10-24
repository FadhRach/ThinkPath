import { Badge } from "@/components/ui/badge";
import { submissionStatusMeta } from "@/features/submissions/lib/status";
import type { SubmissionStatus } from "@/lib/types";

export function StatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus;
  className?: string;
}) {
  const meta = submissionStatusMeta(status);
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
