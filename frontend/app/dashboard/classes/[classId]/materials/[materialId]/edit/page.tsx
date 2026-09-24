import { notFound } from "next/navigation";

import { BackLink } from "@/components/common/BackLink";
import { Callout } from "@/components/common/Callout";
import { PageHeader } from "@/components/common/PageHeader";
import { MaterialForm } from "@/components/dashboard/MaterialForm";
import { Card } from "@/components/ui/card";
import { getClassMaterials, getClasses } from "@/lib/data";
import { groupByTopic } from "@/lib/materials";

export default async function EditMaterialPage({
  params,
}: {
  params: { classId: string; materialId: string };
}) {
  const classes = await getClasses();
  const targetClass = classes.find((cls) => cls.id === params.classId);
  if (!targetClass) {
    notFound();
  }
  const materials = await getClassMaterials(targetClass.id);
  const material = materials.find((item) => item.id === params.materialId);
  if (!material) {
    notFound();
  }
  const topics = groupByTopic(materials)
    .map((group) => group.topic)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <BackLink
        href={`/dashboard/classes/${targetClass.id}?tab=materi`}
        label="Kembali ke kelas"
      />
      <PageHeader title="Ubah Materi" subtitle={`${targetClass.name} · ${material.title}`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6 shadow-soft">
          <MaterialForm classId={targetClass.id} topics={topics} material={material} />
        </Card>
        <Callout variant="info" title="Tanpa notifikasi ulang">
          Perubahan langsung terlihat di halaman Materi mahasiswa. Lonceng mereka
          tidak berbunyi lagi, jadi merapikan topik atau salah ketik tidak
          mengganggu.
        </Callout>
      </div>
    </div>
  );
}
