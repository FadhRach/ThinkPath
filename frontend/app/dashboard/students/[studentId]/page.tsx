import { notFound } from "next/navigation";

import { CognitiveClassCard } from "@/features/overview/components/CognitiveClassCard";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api/errors";
import { getStudentProfile } from "@/lib/data";

interface Props {
  params: Promise<{ studentId: string }>;
}

export default async function StudentProfilePage({ params }: Props) {
  const { studentId } = await params;
  let profile;
  try {
    profile = await getStudentProfile(studentId);
  } catch (error) {
    // Hanya "tidak ada / bukan hak Anda" yang jadi 404; galat lain ke error.tsx.
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const belowTarget = profile.classes.filter(
    (series) =>
      series.current_level != null &&
      series.average_target != null &&
      series.current_level - series.average_target <= -1,
  );

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Analitik", href: "/dashboard/analitik" },
          { label: profile.student.display_name },
        ]}
      />

      <Card className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
        <AvatarInitials name={profile.student.display_name} size="lg" />
        <div className="min-w-0">
          <h1 className="break-words text-heading font-bold text-foreground">
            {profile.student.display_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Profil kognitif: perkembangan level penalaran lintas tugas, per kelas.
          </p>
        </div>
      </Card>

      <Alert variant="info" title="Cara membaca halaman ini">
        Level dihitung dari teks jawaban, <strong>bukan</strong> dari nilai atau skor AI. Angka
        level saat ini memakai rata-rata bergerak, sehingga tugas terbaru berbobot lebih besar
        daripada tugas awal semester. Mahasiswa yang naik dari L1 ke L4 tidak sedang berada di L2.
      </Alert>

      {belowTarget.length > 0 ? (
        <Alert variant="warning" title="Perlu perhatian pengajaran">
          Di {belowTarget.length} kelas, level penalaran mahasiswa ini tertinggal minimal satu
          tingkat dari target tugas: {belowTarget.map((series) => series.class_name).join(", ")}.
          Celah ini layak ditangani lebih dulu daripada dugaan penggunaan AI, karena ia terukur
          sedangkan dugaan masih harus diverifikasi.
        </Alert>
      ) : null}

      {profile.classes.length === 0 ? (
        <EmptyState
          title="Belum ada tugas yang dianalisis"
          caption="Profil kognitif muncul setelah mahasiswa mengumpulkan tugas dan analisis selesai dijalankan."
        />
      ) : (
        profile.classes.map((series) => (
          <CognitiveClassCard key={series.class_id} series={series} showBand linkSubmissions />
        ))
      )}
    </div>
  );
}
