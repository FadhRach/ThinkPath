"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { FilterPills } from "@/components/shared/FilterPills";
import { SearchInput } from "@/components/shared/IconInput";
import { ScrollStrip } from "@/components/shared/ScrollStrip";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { AnalysisPoller } from "@/features/submissions/components/AnalysisPoller";
import { ReviewGroupCard } from "@/features/submissions/components/ReviewGroupCard";
import {
  ALL,
  SORT_LABEL,
  filterReviewRows,
  groupByAssignment,
  matchesStatus,
  sortReviewRows,
  type ReviewSort,
  type ReviewStatus,
} from "@/features/submissions/lib/review";
import type { TeacherAssignmentRow, TeacherSubmissionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReviewBoardProps {
  submissions: TeacherSubmissionRow[];
  assignments: TeacherAssignmentRow[];
  classes: { id: string; name: string }[];
  /** Pilihan awal dari alamat (?kelas= dan ?tugas=). */
  initialClassId?: string;
  initialAssignmentId?: string;
}

/**
 * Papan pemeriksaan: pilih kelas, lalu tugas, baru melihat mahasiswanya. Itu urutan kerja dosen:
 * fokus ke satu tugas sampai tuntas. Bisa dicari, diurutkan, dan disaring menurut status.
 */
export function ReviewBoard({
  submissions,
  assignments,
  classes,
  initialClassId,
  initialAssignmentId,
}: ReviewBoardProps) {
  const initialAssignment = assignments.find((item) => item.id === initialAssignmentId);
  const [classId, setClassId] = useState(
    initialClassId && classes.some((item) => item.id === initialClassId)
      ? initialClassId
      : (initialAssignment?.class_id ?? ALL),
  );
  const [assignmentId, setAssignmentId] = useState(initialAssignment?.id ?? ALL);
  const [status, setStatus] = useState<ReviewStatus>("perlu");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ReviewSort>("terlama");

  const targets = useMemo(
    () => new Map(assignments.map((item) => [item.id, item.expected_bloom_level])),
    [assignments],
  );
  const classAssignments = assignments.filter(
    (item) => classId === ALL || item.class_id === classId,
  );

  // Hitungan pada pil dan kartu kelas mengikuti pilihan lain, supaya angkanya selalu jujur.
  const inScope = filterReviewRows(submissions, { classId, assignmentId, status: "semua", query });
  const rows = inScope.filter((row) => matchesStatus(row, status));
  const groups = groupByAssignment(sortReviewRows(rows, sort, targets), assignments);
  const waitingByClass = (id: string) =>
    submissions.filter((row) => row.status === "submitted" && (id === ALL || row.class_id === id))
      .length;
  const analysing = submissions.some(
    (row) => row.analysis_state === "pending" || row.analysis_state === "running",
  );

  function pickClass(id: string) {
    setClassId(id);
    setAssignmentId(ALL);
  }
  function reset() {
    setClassId(ALL);
    setAssignmentId(ALL);
    setStatus("semua");
    setQuery("");
  }

  return (
    <div className="space-y-5">
      {analysing ? <AnalysisPoller /> : null}

      <ScrollStrip label="Pilih kelas">
        {[{ id: ALL, name: "Semua kelas" }, ...classes].map((item) => {
          const selected = item.id === classId;
          const waiting = waitingByClass(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => pickClass(item.id)}
              className={cn(
                "h-full w-full rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-secondary/40 ring-1 ring-primary"
                  : "border-border hover:bg-accent/40",
              )}
            >
              <span className="block truncate text-sm font-semibold text-foreground">
                {item.name}
              </span>
              <span
                className={cn(
                  "mt-1 block text-xs",
                  waiting ? "font-semibold text-warning" : "text-muted-foreground",
                )}
              >
                {waiting ? `${waiting} perlu diperiksa` : "Tidak ada antrean"}
              </span>
            </button>
          );
        })}
      </ScrollStrip>

      <div className="flex flex-col gap-3 lg:flex-row">
        <NativeSelect
          aria-label="Saring menurut tugas"
          value={assignmentId}
          onChange={(event) => setAssignmentId(event.target.value)}
          className="lg:w-72"
        >
          <option value={ALL}>Semua tugas ({classAssignments.length})</option>
          {classAssignments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
              {classId === ALL ? ` · ${item.class_name}` : ""}
            </option>
          ))}
        </NativeSelect>
        <div className="min-w-0 flex-1">
          <SearchInput
            aria-label="Cari mahasiswa"
            placeholder="Cari nama mahasiswa"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="Urutkan"
          value={sort}
          onChange={(event) => setSort(event.target.value as ReviewSort)}
          className="lg:w-64"
        >
          {(Object.keys(SORT_LABEL) as ReviewSort[]).map((key) => (
            <option key={key} value={key}>
              Urutkan: {SORT_LABEL[key]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <FilterPills
        label="Saring menurut status"
        value={status}
        onChange={setStatus}
        options={(
          [
            ["perlu", "Perlu diperiksa"],
            ["semua", "Semua"],
            ["dinilai", "Sudah dinilai"],
            ["perhatian", "Perlu perhatian"],
          ] as Array<[ReviewStatus, string]>
        ).map(([value, label]) => ({
          value,
          label,
          count: inScope.filter((row) => matchesStatus(row, value)).length,
        }))}
      />

      {groups.length ? (
        groups.map((group) => <ReviewGroupCard key={group.assignment.id} group={group} />)
      ) : (
        <EmptyState
          title={
            status === "perlu"
              ? "Tidak ada yang perlu diperiksa"
              : "Tidak ada pengumpulan yang cocok"
          }
          caption={
            status === "perlu"
              ? "Semua pengumpulan pada pilihan ini sudah dinilai. Pilih “Semua” untuk melihat riwayatnya."
              : "Ubah kelas, tugas, atau kata kunci untuk melihat pengumpulan lain."
          }
          action={
            <Button type="button" variant="outline" onClick={reset}>
              Tampilkan semua
            </Button>
          }
        />
      )}
    </div>
  );
}
