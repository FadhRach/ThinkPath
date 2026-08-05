import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { ClassSummary } from "@/lib/types";
import { academicLabel } from "@/lib/academic";

export function TeacherClassCard({ studentClass }: { studentClass: ClassSummary }) {
  return (
    <Link href={`/dashboard/classes/${studentClass.id}`} className="group block">
      <Card className="flex h-full flex-col justify-between gap-4 p-5 shadow-soft transition group-hover:border-primary/50 group-hover:shadow-soft-lg">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">{studentClass.name}</h2>
          <p className="text-body-sm text-muted-foreground">
            {studentClass.subject} &middot; {academicLabel(studentClass)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-body-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              {studentClass.assignment_count} tugas
            </span>
            <span className="rounded-lg border border-primary bg-secondary px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wider text-primary">
              {studentClass.join_code}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-body-sm font-semibold text-primary">
            Lihat
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
