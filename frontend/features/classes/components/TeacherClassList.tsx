import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { academicLabel } from "@/features/classes/lib/academic";
import type { AssignmentSummary, ClassSummary } from "@/lib/types";

/** Daftar ringkas kelas dosen di dasbor, dengan jumlah pengumpulan yang menunggu per kelas. */
export function TeacherClassList({
  classes,
  assignments,
}: {
  classes: ClassSummary[];
  assignments: AssignmentSummary[];
}) {
  if (!classes.length) {
    return (
      <EmptyState
        title="Belum ada kelas"
        caption="Buat kelas, lalu bagikan kode undangan kepada mahasiswa."
        action={
          <Button asChild>
            <Link href="/dashboard/classes/new">Buat kelas</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {classes.map((classroom) => {
          const waiting = assignments
            .filter((item) => item.class_id === classroom.id)
            .reduce((sum, item) => sum + item.needs_review_count, 0);
          return (
            <li
              key={classroom.id}
              className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/classes/${classroom.id}`}
                  className="text-heading font-semibold underline-offset-4 hover:underline"
                >
                  {classroom.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{academicLabel(classroom)}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {classroom.assignment_count} tugas · Kode kelas{" "}
                  <span className="tabular-nums text-foreground">{classroom.join_code}</span>
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p
                  className={`text-sm ${waiting ? "font-medium text-danger" : "text-muted-foreground"}`}
                >
                  {waiting ? `${waiting} perlu diperiksa` : "Tidak ada pengumpulan baru"}
                </p>
                <Link
                  href={`/dashboard/classes/${classroom.id}`}
                  className="mt-2 inline-block text-sm font-medium text-brand-ink hover:underline"
                >
                  Buka kelas →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
