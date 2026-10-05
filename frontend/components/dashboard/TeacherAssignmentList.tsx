"use client";

import { ArrowRight, CalendarClock, ClipboardList, Pencil, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BloomBadge } from "@/components/common/BloomBadge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DISPLAY_TIME_ZONE, formatClockHHMM, formatDate } from "@/lib/formatting";
import type { TeacherAssignmentRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "Semua" },
  { id: "open", label: "Masih dibuka" },
  { id: "review", label: "Perlu diperiksa" },
  { id: "closed", label: "Tenggat lewat" },
] as const;

export function TeacherAssignmentList({ assignments, showClass = true }: {
  assignments: TeacherAssignmentRow[]; showClass?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const now = Date.now();
  const visible = assignments.filter((item) => {
    const overdue = !!item.deadline && new Date(item.deadline).getTime() < now;
    const matchesQuery = `${item.title} ${item.class_name}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "open" && !overdue) ||
      (filter === "closed" && overdue) || (filter === "review" && item.needs_review_count > 0);
    return matchesQuery && matchesFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="bg-card pl-9" aria-label="Cari tugas" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari tugas atau kelas…" />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={cn("rounded-full border px-3 py-2 text-xs font-semibold transition", filter === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40")}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">{visible.length} tugas ditampilkan</p>
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((item) => {
          const closed = !!item.deadline && new Date(item.deadline).getTime() < now;
          const href = `/dashboard/classes/${item.class_id}?tab=tugas&assignment=${item.id}`;
          return (
            <Card key={item.id} className="campus-card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-accent-foreground"><ClipboardList className="h-5 w-5" /></span>
                <span className={cn("rounded-full px-2.5 py-1 text-[0.65rem] font-bold", closed ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground")}>{closed ? "Tenggat lewat" : "Masih dibuka"}</span>
              </div>
              {showClass ? <p className="mt-3 text-xs font-semibold text-accent-foreground">{item.class_name}</p> : null}
              <h3 className="mt-2 break-words text-lg font-semibold leading-snug"><Link href={href} className="hover:text-primary">{item.title}</Link></h3>
              <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">{item.instructions || "Belum ada instruksi tambahan."}</p>
              <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-4 w-4 shrink-0" />
                {item.deadline ? `${formatDate(item.deadline)} · ${formatClockHHMM(item.deadline)} (${DISPLAY_TIME_ZONE})` : "Tanpa tenggat"}
              </p>
              <div className="mb-5 mt-3 flex flex-wrap items-center gap-2">
                <BloomBadge level={item.expected_bloom_level} />
                <span className="text-xs text-muted-foreground">{item.submission_count} pengumpulan</span>
                {item.needs_review_count > 0 ? <span className="rounded-full bg-brand-pink px-2 py-1 text-[0.65rem] font-bold text-danger">{item.needs_review_count} perlu diperiksa</span> : null}
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                <Link href={`${href}&filter=needs_review`} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">{item.needs_review_count ? "Periksa pengumpulan" : "Lihat pengumpulan"}<ArrowRight className="h-4 w-4" /></Link>
                <Link href={`/dashboard/classes/${item.class_id}/assignments/${item.id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-semibold hover:bg-secondary"><Pencil className="h-3.5 w-3.5" />Edit tugas</Link>
              </div>
            </Card>
          );
        })}
      </div>
      {!visible.length ? (
        <Card className="campus-card px-5 py-12 text-center">
          <ClipboardList className="mx-auto h-7 w-7 text-accent-foreground" />
          <h3 className="mt-3 font-bold">{assignments.length ? "Tidak ada tugas yang cocok" : "Belum ada tugas"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{assignments.length ? "Ubah pencarian atau filter untuk melihat tugas lainnya." : "Gunakan tombol Buat tugas untuk menyiapkan kegiatan belajar."}</p>
        </Card>
      ) : null}
    </div>
  );
}
