"use client";

import { ArrowRight, LineChart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AnalysisPoller } from "@/features/submissions/components/AnalysisPoller";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { BloomBadge } from "@/features/bloom/components/BloomBadge";
import { AiBandBadge } from "@/features/submissions/components/AiBandBadge";
import { StatusBadge } from "@/features/submissions/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterPills } from "@/components/shared/FilterPills";
import { SearchInput } from "@/components/shared/IconInput";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { SubmissionRow, TeacherSubmissionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "needs_review" | "reviewed" | "high_ai";
type Row = SubmissionRow & Partial<Pick<TeacherSubmissionRow, "class_name" | "assignment_title">>;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "needs_review", label: "Perlu diperiksa" },
  { id: "all", label: "Semua" },
  { id: "reviewed", label: "Sudah dinilai" },
  { id: "high_ai", label: "Perlu diperhatikan" },
];

// Bukan daftar tersangka: skor AI tinggi ATAU pola pengerjaan yang perlu dilihat,
// dua bukti terpisah yang sama-sama layak ditinjau bersama konteks dosen.
function isWorthAttention(row: Row) {
  return row.analysis?.ai_band === "high" || row.analysis?.process_band === "attention";
}

function matches(row: Row, filter: Filter) {
  return (
    filter === "all" ||
    (filter === "needs_review" && row.status === "submitted") ||
    (filter === "reviewed" && row.status === "reviewed") ||
    (filter === "high_ai" && isWorthAttention(row))
  );
}

export function SubmissionTable({
  submissions,
  initialFilter = "all",
}: {
  submissions: Row[];
  initialFilter?: Filter;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const visible = submissions.filter(
    (row) =>
      matches(row, filter) &&
      `${row.student.display_name} ${row.class_name || ""} ${row.assignment_title || ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  const analysing = submissions.some(
    (row) => row.analysis_state === "pending" || row.analysis_state === "running",
  );

  return (
    <Card className="overflow-hidden">
      {analysing ? <AnalysisPoller /> : null}
      <div className="space-y-3 border-b border-border p-4 sm:p-5">
        <SearchInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari mahasiswa, kelas, atau tugas…"
          aria-label="Cari pengumpulan"
        />
        <FilterPills
          label="Filter pengumpulan"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((option) => ({
            value: option.id,
            label: option.label,
            count: submissions.filter((row) => matches(row, option.id)).length,
          }))}
        />
      </div>
      <p className="px-4 pt-3 text-xs text-muted-foreground sm:px-5" aria-live="polite">
        {visible.length} pengumpulan ditampilkan
      </p>
      {visible.length ? (
        <ul className="divide-y divide-border/70">
          {visible.map((row) => (
            <li
              key={row.id}
              className="flex flex-col justify-between gap-4 px-4 py-5 sm:px-5 lg:flex-row lg:items-center"
            >
              <div className="flex min-w-0 gap-3">
                <AvatarInitials name={row.student.display_name} size="sm" />
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/submission/${row.id}`}
                    className="break-words font-semibold hover:text-brand-ink"
                  >
                    {row.student.display_name}
                  </Link>
                  {row.assignment_title ? (
                    <p className="mt-1 break-words text-sm font-semibold">{row.assignment_title}</p>
                  ) : null}
                  {row.class_name ? (
                    <p className="mt-1 text-xs font-semibold text-accent-foreground">
                      {row.class_name}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(row.submitted_at)} · {formatRelativeTime(row.submitted_at)}
                    {row.revision_count ? ` · ${row.revision_count} revisi` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={row.status} />
                    {row.grade !== null ? (
                      <span className="text-xs font-bold text-accent-foreground">
                        Nilai {row.grade}/100
                      </span>
                    ) : null}
                    {row.analysis_state === "pending" || row.analysis_state === "running" ? (
                      <span
                        role="status"
                        className="rounded-full bg-muted px-2 py-1 text-micro font-semibold text-muted-foreground"
                      >
                        Sedang dianalisis
                      </span>
                    ) : row.analysis_state === "failed" ? (
                      <span className="rounded-full bg-danger-soft px-2 py-1 text-micro font-semibold text-danger">
                        Analisis gagal
                      </span>
                    ) : null}
                    {row.analysis &&
                    row.analysis_state !== "pending" &&
                    row.analysis_state !== "running" ? (
                      <>
                        <BloomBadge level={row.analysis.bloom_level} />
                        <AiBandBadge band={row.analysis.ai_band} />
                        {row.analysis.process_band === "attention" ? (
                          <Badge
                            tone="warning"
                            size="sm"
                            title="Teks tiba sekaligus, bukan bertahap. Bisa juga karena ditulis di aplikasi lain lalu ditempel."
                          >
                            Pola pengerjaan perlu dilihat
                          </Badge>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-4">
                <Link
                  href={`/dashboard/students/${row.student.id}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand-ink"
                >
                  <LineChart className="h-4 w-4" />
                  Tren
                </Link>
                <Button asChild size="sm">
                  <Link href={`/dashboard/submission/${row.id}`}>
                    {row.status === "reviewed" ? "Lihat penilaian" : "Periksa jawaban"}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-12 text-center">
          <h3 className="font-bold">
            {submissions.length ? "Tidak ada pengumpulan yang cocok" : "Belum ada pengumpulan"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {submissions.length
              ? "Pilih filter lain atau ubah kata kunci pencarian."
              : "Jawaban mahasiswa akan tampil setelah tugas dikumpulkan."}
          </p>
        </div>
      )}
    </Card>
  );
}
