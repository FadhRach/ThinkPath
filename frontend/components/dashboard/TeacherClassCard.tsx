import Link from "next/link";

import { Card } from "@/components/ui/card";
import { academicLabel } from "@/lib/academic";
import { formatDate } from "@/lib/formatting";
import type { ClassSummary, TeacherAssignmentRow } from "@/lib/types";

export function TeacherClassCard({ studentClass, assignments = [] }: {
  studentClass: ClassSummary; assignments?: TeacherAssignmentRow[]; index?: number;
}) {
  const own = assignments.filter((item) => item.class_id === studentClass.id);
  const pending = own.reduce((sum, item) => sum + item.needs_review_count, 0);
  const count = own.reduce((sum, item) => sum + item.submission_count, 0);
  const next = own.filter((item) => item.deadline && new Date(item.deadline).getTime() > Date.now())
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];
  return (
    <Card className="h-full overflow-hidden">
      <Link href={`/dashboard/classes/${studentClass.id}`} className="block h-full p-5 hover:bg-accent/40">
        <h3 className="text-lg font-semibold leading-snug">{studentClass.name}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{academicLabel(studentClass)}</p>
        <p className="mt-3 text-xs text-muted-foreground">{studentClass.assignment_count} tugas · Kode kelas <span className="font-mono text-foreground">{studentClass.join_code}</span></p>
        <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <p className={pending ? "font-medium text-danger" : "text-muted-foreground"}>
            {pending ? `${pending} pengumpulan perlu diperiksa` : count ? "Semua pengumpulan sudah diperiksa" : "Belum ada pengumpulan"}
          </p>
          {next ? <p className="text-xs text-muted-foreground">Tenggat berikutnya: {formatDate(next.deadline)}</p> : null}
        </div>
        <p className="mt-4 text-sm font-medium text-accent-foreground">Buka kelas <span aria-hidden="true">→</span></p>
      </Link>
    </Card>
  );
}
