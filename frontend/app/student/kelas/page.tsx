import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";

import { StudentClassDirectory } from "@/features/classes/components/StudentClassDirectory";
import { JoinCodeForm } from "@/features/classes/components/JoinCodeForm";
import { Card } from "@/components/ui/card";
import { getStudentClasses } from "@/lib/data";

export default async function StudentClassesPage() {
  const classes = await getStudentClasses();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Kelas</h1>

      {classes.length > 0 ? (
        <StudentClassDirectory classes={classes} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(17rem,.7fr)]">
          <div className="rounded-3xl border border-dashed border-border bg-card/75 px-6 py-12 text-center sm:py-16">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <BookOpen className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-foreground">Belum ada kelas di sini</h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
              Minta kode undangan ke dosenmu, lalu gabung untuk mulai melihat materi dan tugas.
            </p>
            <Link
              href="/student"
              className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-ink hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Beranda
            </Link>
          </div>
          <JoinClassPanel />
        </div>
      )}
    </div>
  );
}

function JoinClassPanel() {
  return (
    <Card className="flex flex-col justify-center rounded-xl border-border bg-card p-5 sm:p-6">
      <h2 className="mt-3 font-bold text-foreground">Gabung kelas</h2>
      <p className="mt-1 text-sm text-muted-foreground">Gabung dengan kode yang dibagikan dosen.</p>
      <div className="mt-4">
        <JoinCodeForm />
      </div>
    </Card>
  );
}
