import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { TeacherClassDirectory } from "@/features/classes/components/TeacherClassDirectory";
import { getAllAssignments, getClasses } from "@/lib/data";

export default async function ClassesPage() {
  const [classes, assignments] = await Promise.all([getClasses(), getAllAssignments()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Kelas yang Anda ajar</h1>
      {classes.length ? (
        <TeacherClassDirectory classes={classes} assignments={assignments} />
      ) : (
        <EmptyState
          title="Belum ada kelas"
          caption="Buat kelas pertama, lalu bagikan kode gabung kepada mahasiswa."
          action={
            <Button asChild>
              <Link href="/dashboard/classes/new">Buat kelas</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
