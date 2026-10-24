import { ClassCard } from "@/features/classes/components/ClassCard";
import { teacherLabel } from "@/features/classes/components/ArchivedClassNotice";
import { academicLabel, distinctSubject } from "@/features/classes/lib/academic";
import { formatDate } from "@/lib/formatting";
import type { StudentClassWithAssignments } from "@/lib/types";

export function StudentClassCard({ studentClass }: { studentClass: StudentClassWithAssignments }) {
  const pending = studentClass.assignments
    .filter((item) => !item.submission || item.submission.status === "draft")
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  const nextTask = pending[0];
  const subject = distinctSubject(studentClass.name, studentClass.subject);

  return (
    <ClassCard
      href={`/student/kelas/${studentClass.id}`}
      name={studentClass.name}
      details={
        <>
          {subject ? <p>{subject}</p> : null}
          <p>
            {teacherLabel(studentClass.teacher_name)}
            {studentClass.is_archived ? " · Arsip" : ""}
          </p>
          <p className="text-xs">{academicLabel(studentClass)}</p>
        </>
      }
      status={
        nextTask ? (
          <>
            <p className="text-xs text-muted-foreground">
              {pending.length} tugas belum dikumpulkan
            </p>
            <p className="mt-1 line-clamp-2 font-medium">{nextTask.title}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {nextTask.deadline ? `Tenggat ${formatDate(nextTask.deadline)}` : "Tanpa tenggat"}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            {studentClass.assignments.length ? "Semua tugas sudah dikumpulkan" : "Belum ada tugas"}
          </p>
        )
      }
    />
  );
}
