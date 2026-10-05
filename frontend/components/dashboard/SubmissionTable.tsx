"use client";

import { ArrowRight, LineChart, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AvatarInitials } from "@/components/common/AvatarInitials";
import { BloomBadge } from "@/components/common/BloomBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { SubmissionRow, TeacherSubmissionRow } from "@/lib/types";
import { aiBandBadgeClass, aiBandLabel } from "@/lib/ui";
import { cn } from "@/lib/utils";

type Filter = "all" | "needs_review" | "reviewed" | "high_ai";
type Row = SubmissionRow & Partial<Pick<TeacherSubmissionRow, "class_name" | "assignment_title">>;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "needs_review", label: "Perlu diperiksa" }, { id: "all", label: "Semua" },
  { id: "reviewed", label: "Sudah dinilai" }, { id: "high_ai", label: "Indikasi AI tinggi" },
];

function matches(row: Row, filter: Filter) {
  return filter === "all" || (filter === "needs_review" && row.status === "submitted") ||
    (filter === "reviewed" && row.status === "reviewed") || (filter === "high_ai" && row.analysis?.ai_band === "high");
}

export function SubmissionTable({ submissions, initialFilter = "all" }: { submissions: Row[]; initialFilter?: Filter }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const visible = submissions.filter((row) => matches(row, filter) &&
    `${row.student.display_name} ${row.class_name || ""} ${row.assignment_title || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Card className="campus-card overflow-hidden">
      <div className="space-y-3 border-b border-border p-4 sm:p-5">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari mahasiswa, kelas, atau tugas…" aria-label="Cari pengumpulan" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button key={option.id} type="button" onClick={() => setFilter(option.id)} aria-pressed={filter === option.id} className={cn("rounded-full border px-3 py-2 text-xs font-semibold transition", filter === option.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40")}>
              {option.label}<span className="ml-1.5 opacity-80">{submissions.filter((row) => matches(row, option.id)).length}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="px-4 pt-3 text-xs text-muted-foreground sm:px-5" aria-live="polite">{visible.length} pengumpulan ditampilkan</p>
      {visible.length ? (
        <ul className="divide-y divide-border/70">
          {visible.map((row) => (
            <li key={row.id} className="flex flex-col justify-between gap-4 px-4 py-5 sm:px-5 lg:flex-row lg:items-center">
              <div className="flex min-w-0 gap-3">
                <AvatarInitials name={row.student.display_name} size="sm" />
                <div className="min-w-0">
                  <Link href={`/dashboard/submission/${row.id}`} className="break-words font-semibold hover:text-primary">{row.student.display_name}</Link>
                  {row.assignment_title ? <p className="mt-1 break-words text-sm font-semibold">{row.assignment_title}</p> : null}
                  {row.class_name ? <p className="mt-1 text-xs font-semibold text-accent-foreground">{row.class_name}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.submitted_at)} · {formatRelativeTime(row.submitted_at)}{row.revision_count ? ` · ${row.revision_count} revisi` : ""}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={row.status} />
                    {row.grade !== null ? <span className="text-xs font-bold text-accent-foreground">Nilai {row.grade}/100</span> : null}
                    {row.analysis ? <><BloomBadge level={row.analysis.bloom_level} /><span className={cn("rounded-full px-2 py-1 text-[0.65rem] font-semibold", aiBandBadgeClass(row.analysis.ai_band))}>{aiBandLabel(row.analysis.ai_band)}</span></> : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-4">
                <Link href={`/dashboard/students/${row.student.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><LineChart className="h-4 w-4" />Tren</Link>
                <Link href={`/dashboard/submission/${row.id}`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90">{row.status === "reviewed" ? "Lihat penilaian" : "Periksa jawaban"}<ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-12 text-center">
          <h3 className="font-bold">{submissions.length ? "Tidak ada pengumpulan yang cocok" : "Belum ada pengumpulan"}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{submissions.length ? "Pilih filter lain atau ubah kata kunci pencarian." : "Jawaban mahasiswa akan tampil setelah tugas dikumpulkan."}</p>
        </div>
      )}
    </Card>
  );
}
