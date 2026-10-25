"use client";

import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { FilterPills } from "@/components/shared/FilterPills";
import { SearchInput } from "@/components/shared/IconInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { TeacherAssignmentRowItem } from "@/features/assignments/components/TeacherAssignmentRowItem";
import {
  ALL,
  ASSIGNMENT_SORT_LABEL,
  groupByClass,
  matchesAssignmentStatus,
  sortAssignments,
  type AssignmentSort,
  type AssignmentStatus,
} from "@/features/assignments/lib/teacher-assignments";
import type { TeacherAssignmentRow } from "@/lib/types";

interface TeacherAssignmentListProps {
  assignments: TeacherAssignmentRow[];
  /**
   * Lintas kelas (halaman Tugas): dikelompokkan per kelas dan bisa disaring per kelas.
   * Dalam satu kelas: satu daftar datar tanpa kepala kelompok.
   */
  showClass?: boolean;
}

/** Daftar tugas dosen: dicari, disaring (kelas, tenggat, antrean periksa), dan diurutkan. */
export function TeacherAssignmentList({
  assignments,
  showClass = true,
}: TeacherAssignmentListProps) {
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState(ALL);
  const [status, setStatus] = useState<AssignmentStatus>("semua");
  const [sort, setSort] = useState<AssignmentSort>("tenggat");
  // Dibaca sekali per render: "lewat" dan "dibuka" harus konsisten di seluruh baris.
  const now = useMemo(() => Date.now(), []);

  const classes = useMemo(
    () => [...new Map(assignments.map((item) => [item.class_id, item.class_name])).entries()],
    [assignments],
  );
  const needle = query.trim().toLowerCase();
  const scoped = assignments.filter(
    (item) =>
      (classId === ALL || item.class_id === classId) &&
      (!needle || item.title.toLowerCase().includes(needle)),
  );
  const visible = sortAssignments(
    scoped.filter((item) => matchesAssignmentStatus(item, status, now)),
    sort,
    now,
  );
  const groups = showClass ? groupByClass(visible) : null;

  function reset() {
    setQuery("");
    setClassId(ALL);
    setStatus("semua");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-1">
          <SearchInput
            aria-label="Cari tugas"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari judul tugas"
          />
        </div>
        {showClass && classes.length > 1 ? (
          <NativeSelect
            aria-label="Saring menurut kelas"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            className="lg:w-64"
          >
            <option value={ALL}>Semua kelas</option>
            {classes.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <NativeSelect
          aria-label="Urutkan"
          value={sort}
          onChange={(event) => setSort(event.target.value as AssignmentSort)}
          className="lg:w-56"
        >
          {(Object.keys(ASSIGNMENT_SORT_LABEL) as AssignmentSort[]).map((key) => (
            <option key={key} value={key}>
              Urutkan: {ASSIGNMENT_SORT_LABEL[key]}
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
            ["semua", "Semua"],
            ["dibuka", "Masih dibuka"],
            ["lewat", "Tenggat lewat"],
            ["periksa", "Perlu diperiksa"],
          ] as Array<[AssignmentStatus, string]>
        ).map(([value, label]) => ({
          value,
          label,
          count: scoped.filter((item) => matchesAssignmentStatus(item, value, now)).length,
        }))}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={assignments.length ? "Tidak ada tugas yang cocok" : "Belum ada tugas"}
          caption={
            assignments.length
              ? "Ubah kata kunci, kelas, atau status untuk melihat tugas lain."
              : "Buat tugas pertama untuk memulai pengumpulan jawaban."
          }
          action={
            assignments.length ? (
              <Button type="button" variant="outline" onClick={reset}>
                Tampilkan semua
              </Button>
            ) : (
              <Button asChild>
                <Link href="/dashboard/tugas/new">
                  <Plus /> Buat tugas
                </Link>
              </Button>
            )
          }
        />
      ) : groups ? (
        groups.map((group) => (
          <Card key={group.classId} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3.5 sm:px-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-heading font-semibold text-foreground">
                  <Link
                    href={`/dashboard/classes/${group.classId}?tab=tugas`}
                    className="hover:text-brand-ink"
                  >
                    {group.className}
                  </Link>
                </h2>
                <p className="text-xs text-muted-foreground">{group.items.length} tugas</p>
              </div>
              {group.waiting > 0 ? (
                <Badge tone="warning">{group.waiting} perlu diperiksa</Badge>
              ) : null}
            </div>
            <ul className="divide-y divide-border/70">
              {group.items.map((item) => (
                <li key={item.id}>
                  <TeacherAssignmentRowItem item={item} now={now} />
                </li>
              ))}
            </ul>
          </Card>
        ))
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border/70">
            {visible.map((item) => (
              <li key={item.id}>
                <TeacherAssignmentRowItem item={item} now={now} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
