import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { ClassMaterialBrowser } from "@/features/materials/components/ClassMaterialBrowser";
import type { Material } from "@/lib/types";

/** Tab Materi di halaman kelas dosen. */
export function TeacherMaterialsSection({
  classId,
  materials,
}: {
  classId: string;
  materials: Material[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-heading font-semibold">Materi kelas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Susun bahan belajar menurut topik atau pertemuan.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/classes/${classId}/materials/new`}>Bagikan materi</Link>
        </Button>
      </div>
      {materials.length ? (
        <ClassMaterialBrowser materials={materials} now={Date.now()} manage />
      ) : (
        <EmptyState
          title="Belum ada materi"
          caption="Bagikan bacaan, slide, atau video menggunakan tombol Bagikan materi."
        />
      )}
    </div>
  );
}
