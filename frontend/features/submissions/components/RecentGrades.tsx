import { GraduationCap } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import type { StudentClassWithAssignments } from "@/lib/types";

type GradedAssignment = StudentClassWithAssignments["assignments"][number] & { className: string };

/** Tiga nilai terbaru mahasiswa, atau keterangan bahwa nilai belum ada. */
export function RecentGrades({ items }: { items: GradedAssignment[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconTile icon={GraduationCap} size="sm" />
          <h2 className="font-bold text-foreground">Nilai terbaru</h2>
        </div>
        <Link
          href="/student/gradebook"
          className="text-xs font-semibold text-brand-ink hover:underline"
        >
          Gradebook
        </Link>
      </div>
      {items.length ? (
        <ul className="mt-3 divide-y divide-border/60">
          {items.map((assignment) => (
            <li key={assignment.id} className="flex items-start gap-4 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/student/submit/${assignment.id}`}
                  className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
                >
                  {assignment.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{assignment.className}</p>
              </div>
              <p className="shrink-0 text-lg font-bold tabular-nums">
                {assignment.submission?.grade}
                <span className="ml-1 text-xs font-normal text-muted-foreground">/100</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Nilai akan muncul setelah dosen memeriksa jawabanmu.
        </p>
      )}
    </Card>
  );
}
