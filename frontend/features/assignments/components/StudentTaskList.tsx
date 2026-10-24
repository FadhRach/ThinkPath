"use client";

import { ArrowUpRight, CalendarClock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BloomBadge } from "@/features/bloom/components/BloomBadge";
import { FilterPills } from "@/components/shared/FilterPills";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StudentSubmissionStatus } from "@/lib/types";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export interface StudentTaskRow {
  assignmentId: string;
  title: string;
  classId: string;
  className: string;
  subject: string | null;
  deadline: string | null;
  expectedLevel: number;
  submission: StudentSubmissionStatus | null;
}

type Filter = "semua" | "aktif" | "review" | "dinilai";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "semua", label: "Semua tugas" },
  { key: "aktif", label: "Belum dikumpulkan" },
  { key: "review", label: "Menunggu nilai" },
  { key: "dinilai", label: "Sudah dinilai" },
];

function matchesFilter(row: StudentTaskRow, filter: Filter) {
  if (filter === "aktif") return !row.submission || row.submission.status === "draft";
  if (filter === "review") return row.submission?.status === "submitted";
  if (filter === "dinilai") return row.submission?.status === "reviewed";
  return true;
}

function statusLabel(row: StudentTaskRow) {
  if (!row.submission) return { label: "Belum dimulai", classes: "bg-muted text-muted-foreground" };
  if (row.submission.status === "draft")
    return { label: "Sedang dikerjakan", classes: "bg-accent text-accent-foreground" };
  if (row.submission.status === "submitted")
    return { label: "Menunggu nilai", classes: "bg-brand-pink text-danger" };
  return {
    label: row.submission.grade === null ? "Selesai" : `Dinilai · ${row.submission.grade}`,
    classes: "bg-secondary text-accent-foreground",
  };
}

export function StudentTaskList({ rows }: { rows: StudentTaskRow[] }) {
  const [filter, setFilter] = useState<Filter>("semua");
  const filtered = useMemo(() => rows.filter((row) => matchesFilter(row, filter)), [filter, rows]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map(({ key }) => [key, rows.filter((row) => matchesFilter(row, key)).length]),
      ) as Record<Filter, number>,
    [rows],
  );

  return (
    <div className="space-y-4">
      <FilterPills
        label="Filter status tugas"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map(({ key, label }) => ({ value: key, label, count: counts[key] }))}
      />

      <div className="space-y-3">
        {filtered.length ? (
          filtered.map((row) => {
            const status = statusLabel(row);
            const unfinished = !row.submission || row.submission.status === "draft";
            const overdue =
              unfinished && row.deadline && new Date(row.deadline).getTime() < Date.now();
            const dueSoon =
              unfinished &&
              row.deadline &&
              new Date(row.deadline).getTime() >= Date.now() &&
              new Date(row.deadline).getTime() - Date.now() < 48 * 60 * 60 * 1000;
            return (
              <Card
                key={row.assignmentId}
                className="group overflow-hidden rounded-xl border-border bg-card transition hover:border-border "
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/student/submit/${row.assignmentId}`}
                        className="text-body font-medium text-foreground hover:text-brand-ink"
                      >
                        {row.title}
                      </Link>
                      {dueSoon ? (
                        <span className="rounded-full bg-brand-pink px-2 py-0.5 text-micro font-medium text-danger">
                          Segera tenggat
                        </span>
                      ) : null}
                      {overdue ? (
                        <span className="rounded-full bg-brand-pink px-2 py-0.5 text-micro font-medium text-danger">
                          Lewat tenggat
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.className}
                      {row.subject ? ` · ${row.subject}` : ""}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-micro font-medium",
                          status.classes,
                        )}
                      >
                        {status.label}
                      </span>
                      <BloomBadge level={row.expectedLevel} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border/75 pt-3 sm:w-44 sm:shrink-0 sm:flex-col sm:items-end sm:justify-center sm:border-0 sm:pt-0">
                    <div
                      className={cn("text-xs", overdue ? "text-danger" : "text-muted-foreground")}
                    >
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {row.deadline ? formatDate(row.deadline) : "Tanpa tenggat"}
                      </span>
                      {row.deadline ? (
                        <span className="mt-1 block text-right">
                          {formatRelativeTime(row.deadline)}
                        </span>
                      ) : null}
                    </div>
                    <Button asChild size="sm">
                      <Link href={`/student/submit/${row.assignmentId}`}>
                        Lihat tugas <ArrowUpRight />
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-10 text-center text-sm text-muted-foreground">
            Tidak ada tugas dengan status ini.
          </div>
        )}
      </div>
    </div>
  );
}
