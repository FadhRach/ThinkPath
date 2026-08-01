import { submissionStatusMeta } from "@/lib/ui";
import type { SubmissionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  status: SubmissionStatus;
  className?: string;
}

export function StatusBadge({ status, className }: Props) {
  const meta = submissionStatusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.badgeClass,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
