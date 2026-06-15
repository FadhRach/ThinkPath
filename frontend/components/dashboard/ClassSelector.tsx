import Link from "next/link";

import type { ClassSummary } from "@/lib/types";

interface Props {
  classes: ClassSummary[];
  selectedClassId: string;
}

export function ClassSelector({ classes, selectedClassId }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {classes.map((cls) => {
        const isActive = cls.id === selectedClassId;
        return (
          <Link
            key={cls.id}
            href={`/dashboard?class=${cls.id}`}
            className={
              "rounded-card px-4 py-2 border text-body-sm transition " +
              (isActive
                ? "border-accent text-accent bg-accent-soft"
                : "border-border text-ink hover:bg-accent-soft/50")
            }
          >
            <span>{cls.name}</span>
            <span className="ml-2 text-ink-muted">
              {cls.subject} · {cls.education_level}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
