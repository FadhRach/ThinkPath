import Link from "next/link";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { MaterialsHome, type ClassFolder } from "@/components/materials/MaterialsHome";
import { Button } from "@/components/ui/button";
import { distinctSubject } from "@/lib/academic";
import { getStudentClasses, getStudentMaterials } from "@/lib/data";

export default async function StudentMaterialsPage() {
  const [classes, materials] = await Promise.all([
    getStudentClasses(),
    getStudentMaterials(),
  ]);

  // Urutan kelas mengikuti Beranda, bukan materi terbaru, supaya letak tiap
  // folder tidak berpindah-pindah setiap ada materi baru.
  const folders: ClassFolder[] = classes.map((cls) => ({
    id: cls.id,
    name: cls.name,
    detail: [distinctSubject(cls.name, cls.subject), cls.teacher_name]
      .filter(Boolean)
      .join(" · "),
    materials: materials.filter((material) => material.class_id === cls.id),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materi"
        subtitle="Bahan belajar dari dosenmu, tersusun per kelas dan per pertemuan."
      />

      {classes.length === 0 ? (
        <EmptyState
          title="Belum ada kelas"
          caption="Materi tampil di sini setelah kamu bergabung ke kelas. Masukkan kode kelas dari dosenmu di Beranda."
          action={
            <Button asChild>
              <Link href="/student">Ke Beranda</Link>
            </Button>
          }
        />
      ) : (
        <MaterialsHome folders={folders} materials={materials} now={Date.now()} />
      )}
    </div>
  );
}
