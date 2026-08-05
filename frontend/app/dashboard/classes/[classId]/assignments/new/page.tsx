import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Callout } from "@/components/common/Callout";
import { PageHeader } from "@/components/common/PageHeader";
import { CreateAssignmentForm } from "@/components/dashboard/CreateAssignmentForm";
import { Card } from "@/components/ui/card";
import { getClasses } from "@/lib/data";

export default async function NewAssignmentPage({
  params,
}: {
  params: { classId: string };
}) {
  // Tidak ada endpoint GET single class; daftar kelas milik user cukup kecil.
  const classes = await getClasses();
  const targetClass = classes.find((cls) => cls.id === params.classId);

  if (!targetClass) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/classes/${targetClass.id}`}
        className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke dashboard
      </Link>
      <PageHeader
        title="Buat Tugas Baru"
        subtitle={`${targetClass.name} · ${targetClass.subject}`}
      />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6 shadow-soft">
          <CreateAssignmentForm classId={targetClass.id} />
        </Card>
        <Callout variant="info" title="Tentang target Bloom" icon={ShieldCheck}>
          Target level Bloom membantu sistem menilai kedalaman berpikir yang
          diharapkan dari jawaban mahasiswa. Mahasiswa melihat target ini sebelum
          mengerjakan.
        </Callout>
      </div>
    </div>
  );
}
