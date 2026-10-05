import Link from "next/link";

import { Card } from "@/components/ui/card";
import { academicLabel, distinctSubject } from "@/lib/academic";
import { formatDate } from "@/lib/formatting";
import type { StudentClassWithAssignments } from "@/lib/types";

export function StudentClassCard({ studentClass }: { studentClass: StudentClassWithAssignments; index?: number }) {
  const pending = studentClass.assignments
    .filter((item) => !item.submission || item.submission.status === "draft")
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  const nextTask = pending[0];
  const subject = distinctSubject(studentClass.name, studentClass.subject);

  return (
    <Card className="h-full overflow-hidden">
      <Link href={`/student/kelas/${studentClass.id}`} className="block h-full p-5 underline-offset-4 hover:bg-accent/40">
        <h3 className="text-lg font-semibold leading-snug">{studentClass.name}</h3>
        {subject ? <p className="mt-1 text-sm text-muted-foreground">{subject}</p> : null}
        <p className="mt-3 text-sm text-muted-foreground">{studentClass.teacher_name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{academicLabel(studentClass)}</p>
        <div className="mt-5 border-t border-border pt-4">
          {nextTask ? (
            <>
              <p className="text-xs text-muted-foreground">{pending.length} tugas belum dikumpulkan</p>
              <p className="mt-1 line-clamp-2 text-sm font-medium">{nextTask.title}</p>
              <p className="mt-2 text-xs text-muted-foreground">{nextTask.deadline ? `Tenggat ${formatDate(nextTask.deadline)}` : "Tanpa tenggat"}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{studentClass.assignments.length ? "Semua tugas sudah dikumpulkan" : "Belum ada tugas"}</p>
          )}
        </div>
        <p className="mt-4 text-sm font-medium text-accent-foreground">Buka kelas <span aria-hidden="true">→</span></p>
      </Link>
    </Card>
  );
}
