import { Alert } from "@/components/ui/alert";
import { formatDate } from "@/lib/formatting";
import type { ClassPublic } from "@/lib/types";

/** Nama pengajar; kelas arsip tidak punya dosen lagi. */
export function teacherLabel(name: string | null): string {
  return name ?? "Dosen (akun dihapus)";
}

/** Peringatan di kelas yang dosennya sudah menghapus akun. Kosong untuk kelas aktif. */
export function ArchivedClassNotice({
  klass,
}: {
  klass: Pick<ClassPublic, "is_archived" | "owner_left_at">;
}) {
  if (!klass.is_archived) return null;
  return (
    <Alert variant="warning" title="Dosen kelas ini telah menghapus akunnya">
      Kelas menjadi arsip{klass.owner_left_at ? ` sejak ${formatDate(klass.owner_left_at)}` : ""}.
      Materi, tugas, dan jawabanmu tetap bisa dibaca, tetapi jawaban baru atau revisi tidak diterima
      karena tidak ada dosen yang meninjau.
    </Alert>
  );
}
