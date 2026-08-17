import { CalendarClock, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Callout } from "@/components/common/Callout";
import { DataTable, DataTableRow } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { getVerificationQueue } from "@/lib/data";
import { formatRelativeTime } from "@/lib/formatting";
import { aiBandLabel } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { OUTCOME_LABEL, OUTCOME_TONE, STATUS_LABEL } from "@/lib/verification";

export default async function VerifikasiPage() {
  const queue = await getVerificationQueue();
  const scheduled = queue.filter((row) => row.status === "scheduled");
  const completed = queue.filter((row) => row.status === "completed");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verifikasi Verbal"
        subtitle="Sesi tanya jawab langsung dengan mahasiswa, dijadwalkan dari halaman submission."
      />

      <Callout variant="info" title="Kenapa langkah ini ada">
        Skor dan sinyal hanya menghasilkan dugaan. Yang memutuskan tetap Anda,
        setelah berbicara langsung dengan mahasiswa. Kesimpulan sesi ini{" "}
        <strong>tidak mengubah skor AI</strong>, karena skor yang keliru tidak
        boleh membenarkan dirinya sendiri lewat percakapan yang ia picu sendiri.
      </Callout>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={CalendarClock}
          label="Menunggu sesi"
          value={scheduled.length}
          tone={scheduled.length > 0 ? "warning" : "brand"}
        />
        <StatCard icon={CheckCircle2} label="Sudah diverifikasi" value={completed.length} />
      </div>

      {queue.length === 0 ? (
        <EmptyState
          title="Belum ada sesi verifikasi"
          caption="Buka salah satu submission, lalu jadwalkan sesi dari panel Verifikasi Verbal."
        />
      ) : (
        <>
          <SectionCard eyebrow="Menunggu Sesi">
            <QueueTable
              rows={scheduled}
              emptyMessage="Tidak ada sesi yang menunggu."
            />
          </SectionCard>

          <SectionCard eyebrow="Riwayat">
            <QueueTable rows={completed} emptyMessage="Belum ada sesi yang selesai." />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function QueueTable({
  rows,
  emptyMessage,
}: {
  rows: Awaited<ReturnType<typeof getVerificationQueue>>;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="text-body-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <DataTable
      minWidthClass="min-w-[38rem]"
      headers={["Mahasiswa", "Tugas", "Waktu", "Kesimpulan", "Indikasi AI"]}
    >
      {rows.map((row) => (
        <DataTableRow key={row.submission_id}>
          <td className="py-2.5 pr-4">
            <Link
              href={`/dashboard/submission/${row.submission_id}`}
              className="font-medium text-foreground hover:text-primary"
            >
              {row.student_name}
            </Link>
            <span className="block text-caption text-muted-foreground">
              {row.class_name}
            </span>
          </td>
          <td className="py-2.5 pr-4 text-muted-foreground">
            {row.assignment_title}
          </td>
          <td className="py-2.5 pr-4 text-muted-foreground">
            {row.status === "completed"
              ? formatRelativeTime(row.completed_at)
              : formatRelativeTime(row.scheduled_at)}
          </td>
          <td className="py-2.5 pr-4">
            {row.outcome ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium",
                  OUTCOME_TONE[row.outcome],
                )}
              >
                {OUTCOME_LABEL[row.outcome]}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {STATUS_LABEL[row.status]}
              </span>
            )}
          </td>
          <td className="py-2.5 text-muted-foreground">
            {row.ai_band ? aiBandLabel(row.ai_band) : "-"}
          </td>
        </DataTableRow>
      ))}
    </DataTable>
  );
}
