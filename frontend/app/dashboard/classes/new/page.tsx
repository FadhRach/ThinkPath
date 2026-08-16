import { BackLink } from "@/components/common/BackLink";
import { PageHeader } from "@/components/common/PageHeader";
import { CreateClassForm } from "@/components/dashboard/CreateClassForm";
import { Card } from "@/components/ui/card";

export default function NewClassPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/dashboard" label="Kembali ke dashboard" />
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
