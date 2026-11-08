import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { StudentClassDirectory } from "@/features/classes/components/StudentClassDirectory";
import { JoinCodeForm } from "@/features/classes/components/JoinCodeForm";
import { EmptyState } from "@/components/shared/EmptyState";
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
          <EmptyState
            title="Belum ada kelas di sini"
            caption="Minta kode undangan ke dosenmu, lalu gabung untuk mulai melihat materi dan tugas."
            action={
              <Link
                href="/student"
                className="inline-flex items-center gap-1 text-sm font-bold text-brand-ink hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Beranda
              </Link>
            }
          />
          <JoinClassPanel />
        </div>
      )}
    </div>
  );
}

function JoinClassPanel() {
  return (
    <Card className="flex flex-col justify-center p-5 sm:p-6">
      <h2 className="mt-3 font-bold text-foreground">Gabung kelas</h2>
      <p className="mt-1 text-sm text-muted-foreground">Gabung dengan kode yang dibagikan dosen.</p>
      <div className="mt-4">
        <JoinCodeForm />
      </div>
    </Card>
  );
}
