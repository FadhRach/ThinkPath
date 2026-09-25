import { BellRing } from "lucide-react";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/common/BackLink";
import { Callout } from "@/components/common/Callout";
import { PageHeader } from "@/components/common/PageHeader";
import { MaterialForm } from "@/components/dashboard/MaterialForm";
import { Card } from "@/components/ui/card";
import { distinctSubject } from "@/lib/academic";
import { getClassMaterials, getClasses } from "@/lib/data";
import { groupByTopic } from "@/lib/materials";

export default async function NewMaterialPage({
  params,
}: {
  params: { classId: string };
}) {
  // Tidak ada endpoint GET single class; daftar kelas milik dosen cukup kecil.
  const classes = await getClasses();
  const targetClass = classes.find((cls) => cls.id === params.classId);
  if (!targetClass) {
    notFound();
  }
  const materials = await getClassMaterials(targetClass.id);
  const topics = groupByTopic(materials)
    .map((group) => group.topic)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <BackLink
        href={`/dashboard/classes/${targetClass.id}?tab=materi`}
        label="Kembali ke kelas"
      />
      <PageHeader
        title="Bagikan Materi"
        subtitle={[targetClass.name, distinctSubject(targetClass.name, targetClass.subject)]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6 shadow-soft">
          <MaterialForm classId={targetClass.id} topics={topics} />
        </Card>
        <Callout variant="info" title="Mahasiswa langsung diberi tahu" icon={BellRing}>
          Materi muncul di halaman Materi setiap mahasiswa kelas ini, di bawah topik
          yang Anda pilih, dan lonceng notifikasi mereka membawa langsung ke
          materinya.
        </Callout>
      </div>
    </div>
  );
}
