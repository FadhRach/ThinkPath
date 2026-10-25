import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { ClassChip } from "@/features/classes/components/ClassChip";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { TeacherAssignmentRow } from "@/lib/types";

/** Tenggat mendatang lintas kelas (terdekat di atas), menggulir di dalam kartu; tiap baris menaut ke tugasnya. */
export function UpcomingDeadlines({ assignments }: { assignments: TeacherAssignmentRow[] }) {
  const upcoming = assignments
    .filter((item) => item.deadline && new Date(item.deadline).getTime() > Date.now())
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-center gap-2.5">
        <IconTile icon={CalendarDays} size="sm" />
        <div>
          <h2 className="font-bold text-foreground">Tenggat terdekat</h2>
          <p className="text-xs text-muted-foreground">{upcoming.length} tenggat mendatang</p>
        </div>
      </div>
      {upcoming.length ? (
        <ul className="mt-3 max-h-96 divide-y divide-border/60 overflow-y-auto pr-1 xl:max-h-none xl:min-h-0 xl:flex-1">
          {upcoming.map((item) => (
            <li key={item.id}>
              <Link
                href={`/dashboard/classes/${item.class_id}?tab=tugas&assignment=${item.id}`}
                className="block py-3 hover:underline"
              >
                <span className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</span>
                <ClassChip name={item.class_name} className="mt-1" />
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatDate(item.deadline)} · {formatRelativeTime(item.deadline)}
                  {item.submission_count ? ` · ${item.submission_count} terkumpul` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Belum ada tenggat mendatang.</p>
      )}
    </Card>
  );
}
