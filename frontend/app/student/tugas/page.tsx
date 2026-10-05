import { ClipboardList, Clock3, CheckCircle2, GraduationCap, type LucideIcon } from "lucide-react";

import { StudentTaskList, type StudentTaskRow } from "@/components/student/StudentTaskList";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { distinctSubject } from "@/lib/academic";
import { getStudentClasses } from "@/lib/data";

export default async function StudentTugasPage() {
  const classes = await getStudentClasses();
  const rows: StudentTaskRow[] = classes
    .flatMap((studentClass) =>
      studentClass.assignments.map((assignment) => ({
        assignmentId: assignment.id,
        title: assignment.title,
        classId: studentClass.id,
        className: studentClass.name,
        subject: distinctSubject(studentClass.name, studentClass.subject),
        deadline: assignment.deadline,
        expectedLevel: assignment.expected_bloom_level,
        submission: assignment.submission,
      })),
    )
    .sort((a, b) => {
      if (a.deadline === b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  const notSubmitted = rows.filter((row) => !row.submission || row.submission.status === "draft").length;
  const awaitingReview = rows.filter((row) => row.submission?.status === "submitted").length;
  const reviewed = rows.filter((row) => row.submission?.status === "reviewed").length;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Tugas"
        subtitle="Satu tempat untuk melihat pekerjaan, tenggat, dan hasil dari semua kelasmu."
      />
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <TaskStat icon={Clock3} label="Belum dikumpulkan" value={notSubmitted} tone="coral" />
        <TaskStat icon={ClipboardList} label="Menunggu nilai" value={awaitingReview} tone="teal" />
        <TaskStat icon={CheckCircle2} label="Sudah dinilai" value={reviewed} tone="indigo" />
      </div>
      {rows.length === 0 ? (
        <Card className="rounded-[1.3rem] border-dashed border-border bg-card/75 px-5 py-12 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-accent-foreground" />
          <h2 className="mt-3 font-bold text-foreground">Belum ada tugas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tugas dari kelas yang kamu ikuti akan muncul di sini.</p>
        </Card>
      ) : <StudentTaskList rows={rows} />}
    </div>
  );
}

function TaskStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "coral" | "teal" | "indigo";
}) {
  const colors = {
    coral: "bg-brand-pink text-danger",
    teal: "bg-accent text-accent-foreground",
    indigo: "bg-secondary text-accent-foreground",
  };
  return (
    <Card className="flex min-w-0 items-center gap-2.5 rounded-[1.05rem] border-border bg-card p-3 shadow-none sm:gap-3 sm:p-3.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${colors[tone]}`}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0"><span className="block text-lg font-semibold leading-none text-foreground sm:text-xl">{value}</span><span className="mt-1 block truncate text-[0.65rem] font-medium text-muted-foreground sm:text-xs">{label}</span></span>
    </Card>
  );
}
