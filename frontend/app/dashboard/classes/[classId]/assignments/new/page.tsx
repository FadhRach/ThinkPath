import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { CreateAssignmentForm } from "@/features/assignments/components/CreateAssignmentForm";
import { distinctSubject } from "@/features/classes/lib/academic";
import { getClasses } from "@/lib/data";

export default async function NewAssignmentPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  // Tidak ada endpoint GET single class; daftar kelas milik user cukup kecil.
  const classes = await getClasses();
  const targetClass = classes.find((cls) => cls.id === classId);
  if (!targetClass) notFound();

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: "Kelas", href: "/dashboard/classes" },
          { label: targetClass.name, href: `/dashboard/classes/${targetClass.id}?tab=tugas` },
          { label: "Buat tugas" },
        ]}
      />
      <header>
        <h1 className="text-title font-bold text-foreground">Buat tugas baru</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Untuk{" "}
          {[targetClass.name, distinctSubject(targetClass.name, targetClass.subject)]
            .filter(Boolean)
            .join(" · ")}
          . Mahasiswa kelas ini diberi tahu begitu tugas terbit.
        </p>
      </header>
      <CreateAssignmentForm classId={targetClass.id} />
    </div>
  );
}
