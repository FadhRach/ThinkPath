import Link from "next/link";

import { SectionHeading } from "@/components/shared/SectionHeading";
import type { StudentClassWithAssignments } from "@/lib/types";

type GradedAssignment = StudentClassWithAssignments["assignments"][number] & { className: string };

/** Tiga nilai terbaru mahasiswa, atau keterangan bahwa nilai belum ada. */
export function RecentGrades({ items }: { items: GradedAssignment[] }) {
  return (
    <section aria-labelledby="recent-grades-heading" className="border-t border-border pt-5">
      <SectionHeading
        id="recent-grades-heading"
        title="Nilai terbaru"
        href="/student/progress"
        linkLabel="Progres"
      />
      {items.length ? (
        <ul className="divide-y divide-border">
          {items.map((assignment) => (
            <li key={assignment.id} className="flex items-start gap-4 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/student/submit/${assignment.id}`}
                  className="line-clamp-2 text-sm font-medium leading-relaxed hover:underline"
                >
                  {assignment.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{assignment.className}</p>
              </div>
              <p className="shrink-0 text-lg font-semibold tabular-nums">
                {assignment.submission?.grade}
                <span className="ml-1 text-xs font-normal text-muted-foreground">/100</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nilai akan muncul setelah dosen memeriksa jawabanmu.
        </p>
      )}
    </section>
  );
}
