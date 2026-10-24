import { EmptyState } from "@/components/shared/EmptyState";
import { StudentTaskList } from "@/features/assignments/components/StudentTaskList";
import { buildTaskRows } from "@/features/assignments/lib/student-tasks";
import { getStudentClasses } from "@/lib/data";

export default async function StudentTugasPage() {
  const rows = buildTaskRows(await getStudentClasses());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Tugas</h1>
      {rows.length ? (
        <StudentTaskList rows={rows} />
      ) : (
        <EmptyState
          title="Belum ada tugas"
          caption="Tugas dari kelas yang kamu ikuti akan muncul di sini."
        />
      )}
    </div>
  );
}
