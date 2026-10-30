import { FlaskConical, GraduationCap, LayoutGrid, TrendingDown } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { academicLabel, distinctSubject } from "@/features/classes/lib/academic";
import { DistributionBar } from "@/features/reports/components/DistributionBar";
import { GroupTable } from "@/features/reports/components/GroupTable";
import type { ReportPayload } from "@/lib/types";

/** Ringkasan lintas kelas: kesenjangan kognitif, sebaran indikasi AI, dan rincian per kelompok. */
export function CrossClassReport({ report }: { report: ReportPayload }) {
  const { overview, per_class, per_program, per_semester } = report;
  const analysed = overview.analysed_count;

  if (overview.class_count === 0) {
    return (
      <EmptyState
        title="Belum ada kelas"
        caption="Laporan muncul setelah ada kelas dengan submission yang dianalisis."
      />
    );
  }

  const belowRatio = analysed > 0 ? overview.cognitive_gap.below / analysed : 0;
  // Detektor eksternal sengaja tidak ikut dihitung di sini. Yang dimaksud
  // "Belum tervalidasi": skor dari versi lama (model bahasa, hampir setara tebakan
  // pada uji E1) atau data demo. Heuristik dan detektor sudah diukur pada uji E1.
  const unverified = overview.provenance.llm + overview.provenance.seed;

  return (
    <div className="space-y-6">
      <Alert variant="info" title="Cara membaca laporan ini">
        Angka utama di sini adalah <strong>kesenjangan kognitif</strong>, yaitu berapa banyak
        jawaban yang berada di bawah target Bloom tugasnya. Itu pertanyaan pengajaran: materi mana
        yang belum tersampaikan. Indikasi AI tetap ditampilkan sebagai konteks, tetapi jangan
        dipakai membandingkan kelas atau program studi. Bobot dan ambangnya baru diukur pada abstrak
        akademik publik, belum pada esai mahasiswa berlabel dosen, sehingga selisih antar kelompok
        belum tentu berarti apa pun.
      </Alert>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          stackOnMobile
          icon={LayoutGrid}
          label="Kelas diampu"
          value={overview.class_count}
        />
        <StatCard
          stackOnMobile
          icon={GraduationCap}
          label="Submission dianalisis"
          value={analysed}
          hint={
            overview.submission_count > analysed
              ? `${overview.submission_count - analysed} belum dianalisis`
              : undefined
          }
        />
        <StatCard
          stackOnMobile
          icon={TrendingDown}
          label="Di bawah target Bloom"
          value={`${Math.round(belowRatio * 100)}%`}
          hint={`${overview.cognitive_gap.below} dari ${analysed} jawaban`}
          // Warning, bukan danger: tertinggal dari target adalah soal pengajaran,
          // bukan pelanggaran. Danger disimpan untuk temuan gabungan.
          tone={belowRatio >= 0.25 ? "warning" : "brand"}
        />
        <StatCard
          stackOnMobile
          icon={FlaskConical}
          label="Belum tervalidasi"
          value={unverified}
          hint="skor versi lama atau data demo"
          tone={unverified > 0 ? "warning" : "brand"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard eyebrow="Kesenjangan Kognitif">
          <DistributionBar
            total={analysed}
            segments={[
              {
                label: "Di bawah target",
                count: overview.cognitive_gap.below,
                tone: "bg-warning",
              },
              {
                label: "Sesuai target",
                count: overview.cognitive_gap.on_target,
                tone: "bg-primary",
              },
              {
                label: "Di atas target",
                count: overview.cognitive_gap.above,
                tone: "bg-success",
              },
            ]}
          />
        </SectionCard>

        <SectionCard eyebrow="Sebaran Indikasi AI">
          <DistributionBar
            total={analysed}
            segments={[
              { label: "Rendah", count: overview.ai_band.low, tone: "bg-primary" },
              { label: "Sedang", count: overview.ai_band.mid, tone: "bg-warning" },
              { label: "Tinggi", count: overview.ai_band.high, tone: "bg-danger" },
            ]}
          />
          <p className="text-caption text-muted-foreground">
            Bahan tinjau, bukan vonis. Selalu gabungkan dengan konteks pengerjaan.
          </p>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Per Kelas">
        <GroupTable
          firstColumn="Kelas"
          emptyMessage="Belum ada kelas."
          rows={per_class.map((row) => ({
            ...row,
            key: row.id,
            label: row.name,
            sublabel: [
              distinctSubject(row.name, row.subject),
              academicLabel(row),
              `${row.assignment_count} tugas`,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard eyebrow="Per Program Studi">
          <GroupTable
            firstColumn="Program studi"
            emptyMessage="Belum ada data."
            rows={per_program.map((row) => ({
              ...row,
              key: row.program_studi || "tanpa-prodi",
              label: row.program_studi || "Tanpa prodi",
            }))}
          />
        </SectionCard>

        <SectionCard eyebrow="Per Semester">
          <GroupTable
            firstColumn="Semester"
            emptyMessage="Belum ada data."
            rows={per_semester.map((row) => ({
              ...row,
              key: String(row.semester ?? "tidak-ditentukan"),
              label: row.semester === null ? "Tidak ditentukan" : `Semester ${row.semester}`,
            }))}
          />
        </SectionCard>
      </div>
    </div>
  );
}
