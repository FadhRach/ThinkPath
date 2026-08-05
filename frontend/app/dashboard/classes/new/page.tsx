import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/common/PageHeader";
import { CreateClassForm } from "@/components/dashboard/CreateClassForm";
import { Card } from "@/components/ui/card";

export default function NewClassPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke dashboard
      </Link>
      <PageHeader
        title="Buat Kelas Baru"
        subtitle="Kelas menjadi wadah tugas dan pengumpulan mahasiswa. Kode gabung dibuat otomatis setelah kelas tersimpan."
      />
      <Card className="p-6 shadow-soft">
        <CreateClassForm />
      </Card>
    </div>
  );
}
