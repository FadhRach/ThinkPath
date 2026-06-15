import Link from "next/link";

import type { AssignmentSummary } from "@/lib/types";

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
            href={`/dashboard?class=${classId}&assignment=${assignment.id}`}
            className={
              "rounded-card px-4 py-2 border text-body-sm transition " +
              (isActive
                ? "border-accent text-accent bg-accent-soft"
                : "border-border text-ink hover:bg-accent-soft/50")
            }
          >
            {assignment.title}
          </Link>
        );
      })}
    </div>
  );
}
