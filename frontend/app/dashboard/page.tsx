import { FileText, LayoutGrid } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TeacherClassCard } from "@/components/dashboard/TeacherClassCard";
import { Button } from "@/components/ui/button";
import { getClasses } from "@/lib/data";

export default async function DashboardPage() {
  const classes = await getClasses();
  const assignmentTotal = classes.reduce((sum, cls) => sum + cls.assignment_count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelas Saya"
        subtitle="Pilih kelas untuk melihat tugas dan bukti proses berpikir siswa."
        actions={
          <Button asChild>
            <Link href="/dashboard/classes/new">Buat kelas</Link>
          </Button>
        }
      />

      {classes.length === 0 ? (
        <EmptyState
          title="Belum ada kelas"
          caption="Buat kelas pertama untuk mulai memantau pola berpikir siswa."
          action={
            <Button asChild>
              <Link href="/dashboard/classes/new">Buat kelas</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard icon={LayoutGrid} label="Kelas diampu" value={classes.length} />
            <StatCard icon={FileText} label="Total tugas" value={assignmentTotal} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((studentClass) => (
              <TeacherClassCard key={studentClass.id} studentClass={studentClass} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
