import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { Alert } from "@/components/ui/alert";
import { MaterialForm } from "@/features/materials/components/MaterialForm";
import { Card } from "@/components/ui/card";
import { getClassMaterials, getClasses } from "@/lib/data";
import { groupByTopic } from "@/features/materials/lib/materials";

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ classId: string; materialId: string }>;
}) {
  const { classId, materialId } = await params;
  const classes = await getClasses();
  const targetClass = classes.find((cls) => cls.id === classId);
  if (!targetClass) {
    notFound();
  }
  const materials = await getClassMaterials(targetClass.id);
  const material = materials.find((item) => item.id === materialId);
  if (!material) {
    notFound();
  }
  const topics = groupByTopic(materials)
    .map((group) => group.topic)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Kelas", href: "/dashboard/classes" },
          { label: targetClass.name, href: `/dashboard/classes/${targetClass.id}?tab=materi` },
          { label: "Ubah Materi" },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card variant="raised" className="p-6">
          <MaterialForm classId={targetClass.id} topics={topics} material={material} />
        </Card>
        <Alert variant="info" title="Tanpa notifikasi ulang">
          Perubahan langsung terlihat di halaman Materi mahasiswa. Lonceng mereka tidak berbunyi
          lagi, jadi merapikan topik atau salah ketik tidak mengganggu.
        </Alert>
      </div>
    </div>
  );
}
