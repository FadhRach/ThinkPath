import { ClipboardList, Inbox, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { BloomBadge } from "@/components/common/BloomBadge";
import { DataTable, DataTableRow } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { academicLabel } from "@/lib/academic";
import { getAllAssignments } from "@/lib/data";
import { formatDate } from "@/lib/formatting";
import type { TeacherAssignmentRow } from "@/lib/types";

function isOverdue(row: TeacherAssignmentRow): boolean {
  return row.deadline != null && new Date(row.deadline).getTime() < Date.now();
}

export default async function TugasPage() {
  const assignments = await getAllAssignments();
  const needsReview = assignments.reduce((sum, row) => sum + row.needs_review_count, 0);
  const highBand = assignments.reduce((sum, row) => sum + row.high_band_count, 0);

  const open = assignments.filter((row) => !isOverdue(row));
  const closed = assignments.filter(isOverdue);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar Tugas"
        subtitle="Seluruh tugas dari semua kelas yang Anda ampu, terbaru di atas."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={ClipboardList} label="Total tugas" value={assignments.length} />
        <StatCard
          icon={Inbox}
          label="Menunggu review"
          value={needsReview}
          tone={needsReview > 0 ? "warning" : "brand"}
        />
        <StatCard icon={TriangleAlert} label="Indikasi AI tinggi" value={highBand} />
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          title="Belum ada tugas"
          caption="Buat kelas terlebih dahulu, lalu tambahkan tugas dari halaman kelas tersebut."
        />
      ) : (
        <>
          <SectionCard eyebrow="Masih Berjalan">
            <AssignmentTable rows={open} emptyMessage="Tidak ada tugas yang masih berjalan." />
          </SectionCard>

          <SectionCard eyebrow="Sudah Lewat Tenggat">
            <AssignmentTable rows={closed} emptyMessage="Belum ada tugas yang lewat tenggat." />
          </SectionCard>
        </>
      )}
    </div>
  );
}

function AssignmentTable({
  rows,
  emptyMessage,
}: {
  rows: TeacherAssignmentRow[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="text-body-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <DataTable
      minWidthClass="min-w-[44rem]"
      headers={[
        "Tugas",
        "Kelas",
        "Target",
        "Tenggat",
        "Terkumpul",
        "Perlu review",
        "AI tinggi",
      ]}
    >
      {rows.map((row) => (
        <DataTableRow key={row.id}>
          <td className="py-2.5 pr-4">
            {/* Submission sebuah tugas dibuka dari halaman kelasnya,
                bukan dari rute tugas tersendiri. Tugas yang diklik ikut
                dibawa lewat query supaya tidak mendarat di tugas lain. */}
            <Link
              href={`/dashboard/classes/${row.class_id}?assignment=${row.id}`}
              className="font-medium text-foreground hover:text-primary"
            >
              {row.title}
            </Link>
          </td>
          <td className="py-2.5 pr-4">
            <span className="block text-foreground">{row.class_name}</span>
            <span className="block text-caption text-muted-foreground">
              {row.subject} · {academicLabel({ education_level: row.education_level })}
            </span>
          </td>
          <td className="py-2.5 pr-4">
            <BloomBadge level={row.expected_bloom_level} />
          </td>
          <td className="py-2.5 pr-4 text-muted-foreground">
            {formatDate(row.deadline)}
          </td>
          <td className="py-2.5 pr-4 text-muted-foreground">{row.submission_count}</td>
          <td className="py-2.5 pr-4">
            {row.needs_review_count > 0 ? (
              <span className="font-medium text-warning">{row.needs_review_count}</span>
            ) : (
              <span className="text-muted-foreground">0</span>
            )}
          </td>
          <td className="py-2.5">
            {row.high_band_count > 0 ? (
              <span className="font-medium text-danger">{row.high_band_count}</span>
            ) : (
              <span className="text-muted-foreground">0</span>
            )}
          </td>
        </DataTableRow>
      ))}
    </DataTable>
  );
}
