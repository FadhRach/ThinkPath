import { ClipboardCheck, TrendingDown, TriangleAlert, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { ClassCekPahamTable } from "@/features/classes/components/ClassCekPahamTable";
import { ReviewQueueCard } from "@/features/home/components/ReviewQueueCard";
import { ClassOverviewSection } from "@/features/overview/components/ClassOverviewSection";
import type { CekPahamRow, OverviewClass, TeacherSubmissionRow } from "@/lib/types";

interface ClassAnalyticsTabProps {
  studentCount: number;
  /** Analitik kelas ini; null bila belum ada jawaban yang dianalisis. */
  overview: OverviewClass | null;
  /** Pengumpulan kelas ini yang menunggu dinilai. */
  submissions: TeacherSubmissionRow[];
  cekpaham: CekPahamRow[];
}

/**
 * Tab pertama halaman kelas dosen: gambaran kelas yang langsung terlihat. Angka ringkas, antrean
 * periksa kelas ini, peta dan tren Bloom, serta Cek Paham per mahasiswa.
 */
export function ClassAnalyticsTab({
  studentCount,
  overview,
  submissions,
  cekpaham,
}: ClassAnalyticsTabProps) {
  const waiting = submissions.filter((row) => row.status === "submitted").length;
  const below = overview?.below_target_count ?? 0;
  const flagged = overview?.high_band_count ?? 0;

  return (
    <div className="space-y-5">
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        role="group"
        aria-label="Ringkasan kelas"
      >
        <StatCard icon={Users} label="Mahasiswa" value={studentCount} />
        <StatCard
          icon={ClipboardCheck}
          label="Perlu diperiksa"
          value={waiting}
          tone={waiting > 0 ? "danger" : "brand"}
        />
        <StatCard
          icon={TrendingDown}
          label="Tertinggal dari target"
          value={below}
          tone={below > 0 ? "warning" : "brand"}
          hint="Terukur dari teks jawaban"
        />
        <StatCard
          icon={TriangleAlert}
          label="Pernah berskor AI tinggi"
          value={flagged}
          tone={flagged > 0 ? "danger" : "brand"}
          hint="Masih dugaan, belum diverifikasi"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 xl:h-[28rem]">
          <ReviewQueueCard submissions={submissions} />
        </div>
        <div className="min-w-0">
          <ClassCekPahamTable rows={cekpaham} />
        </div>
      </div>

      {overview ? (
        <ClassOverviewSection data={overview} showTitle={false} showOpenLink={false} />
      ) : (
        <EmptyState
          title="Belum ada jawaban yang dianalisis"
          caption="Peta kelas, sebaran Bloom, dan tren muncul setelah mahasiswa mengumpulkan jawaban dan analisisnya selesai."
        />
      )}
    </div>
  );
}
