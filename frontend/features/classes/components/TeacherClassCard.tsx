import { ClassCard } from "@/features/classes/components/ClassCard";
import { academicLabel } from "@/features/classes/lib/academic";
import { formatDate } from "@/lib/formatting";
import type { ClassSummary, TeacherAssignmentRow } from "@/lib/types";

export function TeacherClassCard({
  studentClass,
  assignments = [],
}: {
  studentClass: ClassSummary;
  assignments?: TeacherAssignmentRow[];
}) {
  const own = assignments.filter((item) => item.class_id === studentClass.id);
  const pending = own.reduce((sum, item) => sum + item.needs_review_count, 0);
  const count = own.reduce((sum, item) => sum + item.submission_count, 0);
  const next = own
    .filter((item) => item.deadline && new Date(item.deadline).getTime() > Date.now())
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];

  return (
    <ClassCard
      href={`/dashboard/classes/${studentClass.id}`}
      name={studentClass.name}
      details={
        <>
          <p>{academicLabel(studentClass)}</p>
          <p className="text-xs">
            {studentClass.assignment_count} tugas · Kode kelas{" "}
            <span className="font-mono text-foreground">{studentClass.join_code}</span>
          </p>
        </>
      }
      status={
        <>
          <p className={pending ? "font-medium text-danger" : "text-muted-foreground"}>
            {pending
              ? `${pending} pengumpulan perlu diperiksa`
              : count
                ? "Semua pengumpulan sudah diperiksa"
                : "Belum ada pengumpulan"}
          </p>
          {next ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Tenggat berikutnya: {formatDate(next.deadline)}
            </p>
          ) : null}
        </>
      }
    />
  );
}
