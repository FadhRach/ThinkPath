import { CheckCircle2, Clock, FileText } from "lucide-react";
import Link from "next/link";

import { BloomBadge } from "@/components/common/BloomBadge";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Card } from "@/components/ui/card";
import { getStudentClasses } from "@/lib/data";
import { formatDate } from "@/lib/formatting";
import type { StudentClassWithAssignments } from "@/lib/types";
import { submissionStatusMeta } from "@/lib/ui";
import { cn } from "@/lib/utils";

interface Row {
  assignmentId: string;
  title: string;
  className: string;
  subject: string;
  deadline: string | null;
  expectedLevel: number;
  submission: StudentClassWithAssignments["assignments"][number]["submission"];
}

/** Ratakan tugas dari semua kelas menjadi satu daftar berurut tenggat. */
function flatten(classes: StudentClassWithAssignments[]): Row[] {
  const rows: Row[] = [];
  for (const cls of classes) {
    for (const assignment of cls.assignments) {
      rows.push({
        assignmentId: assignment.id,
        title: assignment.title,
        className: cls.name,
        subject: cls.subject,
        deadline: assignment.deadline,
        expectedLevel: assignment.expected_bloom_level,
        submission: assignment.submission,
      });
    }
  }
  // Tenggat terdekat lebih dulu; tugas tanpa tenggat ditaruh di akhir.
  return rows.sort((a, b) => {
    if (a.deadline === b.deadline) return 0;
    if (a.deadline === null) return 1;
    if (b.deadline === null) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}

function isDone(row: Row): boolean {
  return row.submission !== null && row.submission.status !== "draft";
}

export default async function StudentTugasPage() {
  const classes = await getStudentClasses();
  const rows = flatten(classes);
  const pending = rows.filter((row) => !isDone(row));
  const done = rows.filter(isDone);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar Tugas"
        subtitle="Semua tugas dari kelas yang kamu ikuti, tenggat terdekat di atas."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Clock}
          label="Belum dikumpulkan"
          value={pending.length}
          tone={pending.length > 0 ? "warning" : "brand"}
        />
        <StatCard icon={CheckCircle2} label="Sudah dikumpulkan" value={done.length} />
        <StatCard icon={FileText} label="Kelas diikuti" value={classes.length} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Belum ada tugas"
          caption="Gabung ke kelas lewat kode dari dosenmu, lalu tugasnya muncul di sini."
        />
      ) : (
        <>
          <Card className="space-y-3 p-5 shadow-soft">
            <p className="caption-eyebrow text-primary">Perlu Dikerjakan</p>
            <TaskTable rows={pending} emptyMessage="Semua tugas sudah kamu kumpulkan." />
          </Card>

          <Card className="space-y-3 p-5 shadow-soft">
            <p className="caption-eyebrow text-primary">Sudah Dikumpulkan</p>
            <TaskTable rows={done} emptyMessage="Belum ada tugas yang dikumpulkan." />
          </Card>
        </>
      )}
    </div>
  );
}

function TaskTable({ rows, emptyMessage }: { rows: Row[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return <p className="text-body-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-body-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Tugas</th>
            <th className="py-2 pr-4 font-medium">Kelas</th>
            <th className="py-2 pr-4 font-medium">Target</th>
            <th className="py-2 pr-4 font-medium">Tenggat</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const overdue =
              row.deadline != null &&
              new Date(row.deadline).getTime() < Date.now() &&
              !isDone(row);

            return (
              <tr key={row.assignmentId} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-4">
                  <Link
                    href={`/student/submit/${row.assignmentId}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {row.title}
                  </Link>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="block text-foreground">{row.className}</span>
                  <span className="block text-caption text-muted-foreground">
                    {row.subject}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <BloomBadge level={row.expectedLevel} />
                </td>
                <td className={cn("py-2.5 pr-4", overdue ? "text-danger" : "text-muted-foreground")}>
                  {formatDate(row.deadline)}
                  {overdue ? <span className="block text-caption">Lewat tenggat</span> : null}
                </td>
                <td className="py-2.5 pr-4">
                  {row.submission ? (
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-caption font-medium",
                        submissionStatusMeta(row.submission.status).badgeClass,
                      )}
                    >
                      {submissionStatusMeta(row.submission.status).label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Belum dimulai</span>
                  )}
                </td>
                <td className="py-2.5 font-medium text-foreground">
                  {row.submission?.grade ?? "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
