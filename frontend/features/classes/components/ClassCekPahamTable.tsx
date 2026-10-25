import { Mic } from "lucide-react";
import Link from "next/link";

import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { DataTable, DataTableRow } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionCard } from "@/components/shared/SectionCard";
import {
  AttemptStatusBadge,
  BandBadge,
  PhaseBadge,
} from "@/features/cekpaham/components/CekPahamBadges";
import { queueStats } from "@/features/cekpaham/lib/queue";
import type { CekPahamRow } from "@/lib/types";

/** Cek Paham di satu kelas: mahasiswa mana, atas tugas apa, sudah dikerjakan atau belum, dan hasilnya. */
export function ClassCekPahamTable({ rows }: { rows: CekPahamRow[] }) {
  const stats = queueStats(rows);

  return (
    <SectionCard eyebrow="Cek Paham per Mahasiswa" className="space-y-3">
      {rows.length === 0 ? (
        <EmptyState
          variant="inline"
          title="Belum ada Cek Paham di kelas ini"
          caption="Buka jawaban seorang mahasiswa, lalu pilih “Minta Cek Paham” untuk memulai tes lisan."
        />
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mic className="h-4 w-4 text-brand-ink" aria-hidden="true" />
              {rows.length} permintaan
            </span>
            <span>{stats.waiting} menunggu dikerjakan</span>
            <span>{stats.scored} sudah dinilai</span>
            {stats.openReports > 0 ? (
              <span className="font-semibold text-warning">
                {stats.openReports} laporan kendala menunggu
              </span>
            ) : null}
          </p>
          <div className="max-h-96 overflow-y-auto">
            <DataTable
              minWidthClass="min-w-[40rem]"
              headers={["Mahasiswa", "Tugas", "Fase", "Hasil", "Laporan"]}
            >
              {rows.map((row) => (
                <DataTableRow key={row.id}>
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/dashboard/cekpaham/${row.id}`}
                      className="flex items-center gap-2.5 font-medium text-foreground hover:text-brand-ink"
                    >
                      <AvatarInitials name={row.student_name} size="sm" />
                      {row.student_name}
                    </Link>
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
                      <span className="font-semibold text-warning">
                        {row.attempt.open_reports} menunggu
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                </DataTableRow>
              ))}
            </DataTable>
          </div>
        </>
      )}
    </SectionCard>
  );
}
