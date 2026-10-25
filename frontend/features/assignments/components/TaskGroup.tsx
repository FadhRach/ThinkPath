"use client";

import { useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StudentTaskCard } from "@/features/assignments/components/StudentTaskCard";
import { StudentTaskCompactRow } from "@/features/assignments/components/StudentTaskCompactRow";
import type { StudentTaskRow, TaskGroupKey } from "@/features/assignments/lib/student-tasks";

/** Tugas yang sudah dikumpulkan tampil ringkas; lewat batas ini sisanya dilipat. */
const COMPACT_LIMIT = 4;

interface TaskGroupProps {
  id: TaskGroupKey;
  title: string;
  hint: string;
  rows: StudentTaskRow[];
}

/**
 * Satu kelompok tugas. "Perlu dikerjakan" berupa kartu lengkap (tenggat, level Bloom, tombol);
 * dua kelompok lainnya berupa daftar ringkas satu baris supaya halaman tidak memanjang.
 */
export function TaskGroup({ id, title, hint, rows }: TaskGroupProps) {
  const [showAll, setShowAll] = useState(false);
  const compact = id !== "todo";
  const visible = compact && !showAll ? rows.slice(0, COMPACT_LIMIT) : rows;

  return (
    <section aria-labelledby={`tasks-${id}`} className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 id={`tasks-${id}`} className="text-heading font-semibold">
          {title}
        </h2>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {rows.length}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">{hint}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          variant="inline"
          title={id === "todo" ? "Tidak ada tugas yang perlu dikerjakan" : "Belum ada"}
          caption={
            id === "todo" ? "Semua tugas sudah kamu kumpulkan." : "Tugas akan muncul di sini."
          }
        />
      ) : compact ? (
        <Card className="divide-y divide-border/70 overflow-hidden">
          {visible.map((row) => (
            <StudentTaskCompactRow key={row.assignmentId} row={row} />
          ))}
          {rows.length > COMPACT_LIMIT ? (
            <div className="px-5 py-2.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={showAll}
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? "Tampilkan lebih sedikit" : `Tampilkan semua (${rows.length})`}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => (
            <StudentTaskCard key={row.assignmentId} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
