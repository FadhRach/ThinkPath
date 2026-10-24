import { BookOpen, GraduationCap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { ClassProgress } from "@/features/classes/components/ClassProgress";
import { teacherLabel } from "@/features/classes/components/ArchivedClassNotice";

interface StudentClassHeaderProps {
  name: string;
  meta: string;
  teacherName: string | null;
  done: number;
  total: number;
  average: number | null;
}

export function StudentClassHeader({
  name,
  meta,
  teacherName,
  done,
  total,
  average,
}: StudentClassHeaderProps) {
  return (
    <Card className="px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
          <IconTile icon={BookOpen} size="lg" />
          <div className="min-w-0">
            <h1 className="text-title font-bold text-foreground">{name}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{meta}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <GraduationCap className="h-4 w-4 text-brand-ink" aria-hidden="true" />
              {teacherLabel(teacherName)}
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center gap-5 lg:w-80">
          <ClassProgress done={done} total={total} className="min-w-0 flex-1" />
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Rata-rata</p>
            <p className="text-xl font-bold tabular-nums text-foreground">{average ?? "–"}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
