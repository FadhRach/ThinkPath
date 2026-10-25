import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { Card } from "@/components/ui/card";
import { CreateClassForm } from "@/features/classes/components/CreateClassForm";

export default function NewClassPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Breadcrumb
        items={[{ label: "Kelas", href: "/dashboard/classes" }, { label: "Buat kelas" }]}
      />
      <Card className="p-5 sm:p-6">
        <h1 className="text-title font-bold text-foreground">Buat kelas baru</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Kelas menjadi wadah tugas dan pengumpulan mahasiswa. Kode gabung dibuat otomatis setelah
          kelas tersimpan.
        </p>
        <div className="mt-6">
          <CreateClassForm />
        </div>
      </Card>
    </div>
  );
}
