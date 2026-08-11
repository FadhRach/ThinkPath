import { FileText, LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TeacherClassCard } from "@/components/dashboard/TeacherClassCard";
import { Button } from "@/components/ui/button";
import { getClasses } from "@/lib/data";

export default async function ClassesPage() {
  const classes = await getClasses();
  const totalAssignments = classes.reduce((sum, item) => sum + item.assignment_count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar Kelas"
        subtitle="Kelas yang Anda ampu, beserta kode gabung untuk mahasiswa."
        actions={
          <Button asChild>
            <Link href="/dashboard/classes/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Kelas baru
            </Link>
          </Button>
        }
      />

      {classes.length === 0 ? (
        <EmptyState
          title="Belum ada kelas"
          caption="Buat kelas pertama Anda, lalu bagikan kode gabungnya ke mahasiswa."
          action={
            <Button asChild>
              <Link href="/dashboard/classes/new">Buat kelas</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard icon={LayoutGrid} label="Jumlah kelas" value={classes.length} />
            <StatCard icon={FileText} label="Total tugas" value={totalAssignments} />
          </div>

          {/* Kartu yang sama dipakai di sini saja sekarang. Overview sudah
              menjadi ringkasan grafik, jadi daftar kelas tidak lagi muncul di
              dua tempat dengan bentuk yang berbeda. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((item) => (
              <TeacherClassCard key={item.id} studentClass={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
