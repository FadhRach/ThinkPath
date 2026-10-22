import { CheckCircle2, Hourglass, MessageSquareWarning } from "lucide-react";
import Link from "next/link";

import { AttemptStatusBadge, BandBadge, PhaseBadge } from "@/components/cekpaham/CekPahamBadges";
import { Callout } from "@/components/common/Callout";
import { DataTable, DataTableRow } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { queueStats, UNCALIBRATED_NOTE } from "@/lib/cekpaham";
import { getCekPahamQueue } from "@/lib/data";

export default async function CekPahamListPage() {
  const rows = await getCekPahamQueue();
  const stats = queueStats(rows);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cek Paham"
        subtitle="Tes lisan singkat atas jawaban mahasiswa, dijawab dengan suara. Dimintakan dari halaman jawaban."
      />

      <Callout variant="info" title="Kenapa langkah ini ada">
        Skor dan sinyal hanya menghasilkan dugaan. Cek Paham memberi mahasiswa kesempatan
        menjelaskan jawabannya sendiri. {UNCALIBRATED_NOTE} Hasilnya{" "}
        <strong>tidak mengubah skor AI maupun nilai</strong>; keputusan tetap di tangan Anda.
      </Callout>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Hourglass} label="Menunggu dikerjakan" value={stats.waiting} />
        <StatCard icon={CheckCircle2} label="Sudah dinilai" value={stats.scored} />
        <StatCard
          icon={MessageSquareWarning}
          label="Laporan menunggu"
          value={stats.openReports}
          tone={stats.openReports > 0 ? "warning" : "brand"}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Belum ada Cek Paham"
          caption="Buka satu jawaban mahasiswa, lalu pilih “Minta Cek Paham”."
        />
      ) : (
        <SectionCard eyebrow="Semua Cek Paham">
          <DataTable minWidthClass="min-w-[44rem]" headers={["Mahasiswa", "Tugas", "Fase", "Hasil", "Laporan"]}>
            {rows.map((row) => (
              <DataTableRow key={row.id}>
                <td className="py-2.5 pr-4">
                  <Link
                    href={`/dashboard/cekpaham/${row.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {row.student_name}
                  </Link>
                  <span className="block text-caption text-muted-foreground">{row.class_name}</span>
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">{row.assignment_title}</td>
                <td className="py-2.5 pr-4">
                  <PhaseBadge phase={row.phase} />
                </td>
                <td className="py-2.5 pr-4">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {row.attempt ? (
                      <AttemptStatusBadge status={row.attempt.status} />
                    ) : (
                      <span className="text-muted-foreground">Belum dikerjakan</span>
                    )}
                    {row.attempt?.ai_band ? <BandBadge band={row.attempt.ai_band} /> : null}
                  </span>
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {row.attempt && row.attempt.open_reports > 0 ? (
                    <span className="font-semibold text-warning">{row.attempt.open_reports} menunggu</span>
                  ) : (
                    "-"
                  )}
                </td>
              </DataTableRow>
            ))}
          </DataTable>
        </SectionCard>
      )}
    </div>
  );
}
