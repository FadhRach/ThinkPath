import { notFound } from "next/navigation";

import { CognitiveClassCard } from "@/components/cognitive/CognitiveClassCard";
import { BackLink } from "@/components/common/BackLink";
import { Callout } from "@/components/common/Callout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { getStudentProfile } from "@/lib/data";

interface Props {
  params: { studentId: string };
}

export default async function StudentProfilePage({ params }: Props) {
  const profile = await getStudentProfile(params.studentId).catch(() => null);
  if (!profile) notFound();

  const belowTarget = profile.classes.filter(
    (series) =>
      series.current_level != null &&
      series.average_target != null &&
      series.current_level - series.average_target <= -1,
  );

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard" label="Kembali ke overview" />

      <PageHeader
        title={profile.student.display_name}
        subtitle="Profil kognitif: perkembangan level penalaran lintas tugas, per kelas."
      />

      <Callout variant="info" title="Cara membaca halaman ini">
        Level dihitung dari teks jawaban, <strong>bukan</strong> dari nilai atau
        skor AI. Angka level saat ini memakai rata-rata bergerak, sehingga tugas
        terbaru berbobot lebih besar daripada tugas awal semester. Mahasiswa yang
        naik dari L1 ke L4 tidak sedang berada di L2.
      </Callout>

      {belowTarget.length > 0 ? (
        <Callout variant="warning" title="Perlu perhatian pengajaran">
          Di {belowTarget.length} kelas, level penalaran mahasiswa ini tertinggal
          minimal satu tingkat dari target tugas:{" "}
          {belowTarget.map((series) => series.class_name).join(", ")}. Celah ini
          layak ditangani lebih dulu daripada dugaan penggunaan AI, karena ia
          terukur sedangkan dugaan masih harus diverifikasi.
        </Callout>
      ) : null}

      {profile.classes.length === 0 ? (
        <EmptyState
          title="Belum ada tugas yang dianalisis"
          caption="Profil kognitif muncul setelah mahasiswa mengumpulkan tugas dan analisis selesai dijalankan."
        />
      ) : (
        profile.classes.map((series) => (
          <CognitiveClassCard
            key={series.class_id}
            series={series}
            showBand
            linkSubmissions
          />
        ))
      )}
    </div>
  );
}
