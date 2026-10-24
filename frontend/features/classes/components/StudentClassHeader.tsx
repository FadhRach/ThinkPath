import { BookOpen, GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { teacherLabel } from "@/features/classes/components/ArchivedClassNotice";

interface StudentClassHeaderProps {
  name: string;
  meta: string;
  teacherName: string | null;
  materialCount: number;
  openCount: number;
}

export function StudentClassHeader({
  name,
  meta,
  teacherName,
  materialCount,
  openCount,
}: StudentClassHeaderProps) {
  return (
    <Card className="px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
          <IconTile icon={BookOpen} size="lg" />
          <div className="min-w-0">
            <h1 className="font-display text-title font-medium text-foreground">{name}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{meta}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <GraduationCap className="h-4 w-4 text-brand-ink" aria-hidden="true" />
              {teacherLabel(teacherName)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Badge tone="neutral" size="md">
            {materialCount} materi
          </Badge>
          <Badge tone="danger" size="md">
            {openCount} tugas aktif
          </Badge>
        </div>
      </div>
    </Card>
  );
}
