import { ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/shared/BackLink";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/PageHeader";
import { CreateAssignmentForm } from "@/features/assignments/components/CreateAssignmentForm";
import { Card } from "@/components/ui/card";
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

  if (!targetClass) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={`/dashboard/classes/${targetClass.id}?tab=tugas`} label="Kembali ke kelas" />
      <PageHeader
        title="Buat tugas baru"
        subtitle={[targetClass.name, distinctSubject(targetClass.name, targetClass.subject)]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5 sm:p-7">
          <CreateAssignmentForm classId={targetClass.id} />
        </Card>
        <Alert variant="info" title="Tentang target Bloom" icon={ShieldCheck}>
          Target level Bloom membantu sistem menilai kedalaman berpikir yang diharapkan dari jawaban
          mahasiswa. Mahasiswa melihat target ini sebelum mengerjakan.
        </Alert>
      </div>
    </div>
  );
}
