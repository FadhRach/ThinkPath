import { ClassCard } from "@/features/classes/components/ClassCard";
import { ClassQuickLinks } from "@/features/classes/components/ClassQuickLinks";
import { ClassProgress } from "@/features/classes/components/ClassProgress";
import { teacherLabel } from "@/features/classes/components/ArchivedClassNotice";
import { academicLabel, distinctSubject } from "@/features/classes/lib/academic";
import { classProgress } from "@/features/classes/lib/student-class";
import { formatDate } from "@/lib/formatting";
import type { StudentClassWithAssignments } from "@/lib/types";

/** Kartu kelas mahasiswa: dosen, progres tugas, rata-rata nilai, dan tugas berikutnya. */
export function StudentClassCard({ studentClass }: { studentClass: StudentClassWithAssignments }) {
  const progress = classProgress(studentClass);
  const subject = distinctSubject(studentClass.name, studentClass.subject);

  return (
    <ClassCard
      href={`/student/kelas/${studentClass.id}`}
      name={studentClass.name}
      actions={<ClassQuickLinks classId={studentClass.id} />}
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
        <div className="space-y-3">
          <ClassProgress done={progress.done} total={progress.total} />
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-muted-foreground">Rata-rata nilai</span>
            <span className="text-base font-bold tabular-nums text-foreground">
              {progress.average ?? "–"}
            </span>
          </div>
          {progress.nextOpen ? (
            <p className="line-clamp-2 rounded-lg bg-muted px-3 py-2 text-xs">
              <span className="font-semibold text-foreground">{progress.nextOpen.title}</span>
              <span className="text-muted-foreground">
                {" · "}
                {progress.nextOpen.deadline
                  ? `tenggat ${formatDate(progress.nextOpen.deadline)}`
                  : "tanpa tenggat"}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {progress.total ? "Semua tugas sudah dikumpulkan." : "Belum ada tugas."}
            </p>
          )}
        </div>
      }
    />
  );
}
