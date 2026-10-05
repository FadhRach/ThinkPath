import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";

import { StudentClassDirectory } from "@/components/student/StudentClassDirectory";
import { JoinCodeForm } from "@/components/student/JoinCodeForm";
import { Card } from "@/components/ui/card";
import { getStudentClasses } from "@/lib/data";

export default async function StudentClassesPage() {
  const classes = await getStudentClasses();
  const activeAssignments = classes.reduce(
    (total, studentClass) =>
      total + studentClass.assignments.filter((assignment) => assignment.submission?.status !== "reviewed").length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Link href="/student" className="transition hover:text-primary">Beranda</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-foreground">Kelas</span>
      </div>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">

          <h1 className="mt-1.5 text-[1.8rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.1rem]">Kelas yang kamu ikuti</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Materi, tugas, dan kabar dosen tersusun rapi di setiap kelas.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-accent-foreground"><BookOpen className="h-3.5 w-3.5" />{classes.length} kelas</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-pink px-3 py-1.5 text-danger">{activeAssignments} tugas aktif</span>
        </div>
      </header>

      {classes.length > 0 ? (
        <StudentClassDirectory classes={classes} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(17rem,.7fr)]">
          <div className="rounded-[1.5rem] border border-dashed border-border bg-card/75 px-6 py-12 text-center sm:py-16">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground"><BookOpen className="h-6 w-6" /></span>
            <h2 className="mt-4 text-lg font-bold text-foreground">Belum ada kelas di sini</h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">Minta kode undangan ke dosenmu, lalu gabung untuk mulai melihat materi dan tugas.</p>
            <Link href="/student" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"><ArrowLeft className="h-4 w-4" />Kembali ke Beranda</Link>
          </div>
          <JoinClassPanel />
        </div>
      )}
      {classes.length > 0 ? <JoinClassPanel /> : null}
    </div>
  );
}

function JoinClassPanel() {
  return (
    <Card className="flex flex-col justify-center rounded-xl border-border bg-card p-5 shadow-none sm:p-6">

      <h2 className="mt-3 font-bold text-foreground">Gabung kelas</h2>
      <p className="mt-1 text-sm text-muted-foreground">Gabung dengan kode yang dibagikan dosen.</p>
      <div className="mt-4"><JoinCodeForm /></div>
    </Card>
  );
}
