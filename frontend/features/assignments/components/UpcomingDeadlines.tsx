import Link from "next/link";

import { formatDate } from "@/lib/formatting";
import type { TeacherAssignmentRow } from "@/lib/types";

/** Empat tenggat terdekat lintas kelas, masing-masing menaut ke tugasnya. */
export function UpcomingDeadlines({ assignments }: { assignments: TeacherAssignmentRow[] }) {
  const upcoming = assignments
    .filter((item) => item.deadline && new Date(item.deadline).getTime() > Date.now())
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    .slice(0, 4);

  return (
    <section>
      <h2 className="text-heading font-semibold">Tenggat terdekat</h2>
      <div className="mt-2 divide-y divide-border">
        {upcoming.length ? (
          upcoming.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/classes/${item.class_id}?tab=tugas&assignment=${item.id}`}
              className="block py-4 underline-offset-4 hover:underline"
            >
              <p className="text-xs text-muted-foreground">{formatDate(item.deadline)}</p>
              <h3 className="mt-1 text-sm font-medium leading-relaxed">{item.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{item.class_name}</p>
            </Link>
          ))
        ) : (
          <p className="py-4 text-sm text-muted-foreground">Belum ada tenggat mendatang.</p>
        )}
      </div>
    </section>
  );
}
