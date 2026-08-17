import { GraduationCap, LayoutGrid, TrendingDown } from "lucide-react";

import { Callout } from "@/components/common/Callout";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { DistributionBar } from "@/components/report/DistributionBar";
import { GroupTable } from "@/components/report/GroupTable";
import { academicLabel } from "@/lib/academic";
import { getReportOverview } from "@/lib/data";

export default async function LaporanPage() {
  const report = await getReportOverview();
  const { overview, per_class, per_program, per_semester } = report;
  const analysed = overview.analysed_count;

  if (overview.class_count === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Laporan" subtitle="Ringkasan lintas kelas yang Anda ampu." />
        <EmptyState
          title="Belum ada kelas"
          caption="Laporan muncul setelah ada kelas dengan submission yang dianalisis."
        />
      </div>
    );
  }

  const belowRatio = analysed > 0 ? overview.cognitive_gap.below / analysed : 0;
  // Detektor eksternal sengaja tidak ikut dihitung di sini. Yang dimaksud
  // "belum terverifikasi" adalah angka yang berasal dari hitungan cadangan atau
  // data contoh, bukan angka yang berasal dari jalur analisis nyata.
  const unverified = overview.provenance.heuristic + overview.provenance.seed;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan"
        subtitle="Ringkasan lintas kelas yang Anda ampu, diurutkan dari yang paling butuh perhatian."
      />

      <Callout variant="info" title="Cara membaca laporan ini">
        Angka utama di sini adalah <strong>kesenjangan kognitif</strong>, yaitu berapa
        banyak jawaban yang berada di bawah target Bloom tugasnya. Itu pertanyaan
        pengajaran: materi mana yang belum tersampaikan. Indikasi AI tetap
        ditampilkan sebagai konteks, tetapi jangan dipakai membandingkan kelas atau
        program studi. Bobotnya belum dikalibrasi terhadap data berlabel, sehingga
        selisih antar kelompok belum tentu berarti apa pun.
      </Callout>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={LayoutGrid} label="Kelas diampu" value={overview.class_count} />
        <StatCard
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
          icon={TrendingDown}
          label="Di bawah target Bloom"
          value={`${Math.round(belowRatio * 100)}%`}
          hint={`${overview.cognitive_gap.below} dari ${analysed} jawaban`}
          tone={belowRatio >= 0.5 ? "danger" : belowRatio >= 0.25 ? "warning" : "brand"}
        />
        <StatCard
          label="Belum tervalidasi"
          value={unverified}
          hint="dihitung cadangan atau data demo"
          tone={unverified > 0 ? "warning" : "brand"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard eyebrow="Kesenjangan Kognitif">
          <DistributionBar
            total={analysed}
            segments={[
              {
                label: "Di bawah target",
                count: overview.cognitive_gap.below,
                tone: "bg-danger",
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
            sublabel: `${row.subject} · ${academicLabel(row)} · ${row.assignment_count} tugas`,
          }))}
        />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
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
              label:
                row.semester === null ? "Tidak ditentukan" : `Semester ${row.semester}`,
            }))}
          />
        </SectionCard>
      </div>
    </div>
  );
}
