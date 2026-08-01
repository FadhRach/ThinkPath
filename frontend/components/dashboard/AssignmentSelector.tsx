import Link from "next/link";

import type { AssignmentSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  classId: string;
  assignments: AssignmentSummary[];
  selectedAssignmentId: string;
}

export function AssignmentSelector({
  classId,
  assignments,
  selectedAssignmentId,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {assignments.map((assignment) => {
        const isActive = assignment.id === selectedAssignmentId;
        return (
          <Link
            key={assignment.id}
            href={`/dashboard/classes/${classId}?assignment=${assignment.id}`}
            className={cn(
              "rounded-full border px-4 py-2 text-body-sm transition",
              isActive
                ? "border-primary bg-secondary font-semibold text-secondary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {assignment.title}
          </Link>
        );
      })}
    </div>
  );
}
