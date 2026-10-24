import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { CreateClassForm } from "@/features/classes/components/CreateClassForm";
import { Card } from "@/components/ui/card";

export default function NewClassPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/dashboard" label="Kembali ke dashboard" />
      <PageHeader
        title="Buat Kelas Baru"
        subtitle="Kelas menjadi wadah tugas dan pengumpulan mahasiswa. Kode gabung dibuat otomatis setelah kelas tersimpan."
      />
      <Card variant="raised" className="p-6">
        <CreateClassForm />
      </Card>
    </div>
  );
}
