"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { FilterPills } from "@/components/shared/FilterPills";
import { SearchInput } from "@/components/shared/IconInput";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { TaskGroup } from "@/features/assignments/components/TaskGroup";
import {
  filterTasks,
  groupTasks,
  type StudentTaskRow,
  type TaskGroupKey,
  type TaskStatusFilter,
} from "@/features/assignments/lib/student-tasks";

const GROUPS: Array<{ key: TaskGroupKey; title: string; hint: string; pill: string }> = [
  {
    key: "todo",
    title: "Perlu dikerjakan",
    hint: "Tenggat terdekat di atas.",
    pill: "Perlu dikerjakan",
  },
  {
    key: "waiting",
    title: "Menunggu nilai",
    hint: "Sudah kamu kumpulkan; dosen belum menilai.",
    pill: "Menunggu nilai",
  },
  {
    key: "graded",
    title: "Sudah dinilai",
    hint: "Nilai dan umpan balik dosen.",
    pill: "Sudah dinilai",
  },
];

const ALL = "semua";

/**
 * Daftar tugas semua kelas. Bisa dicari, disaring per kelas, dan disaring per status;
 * jumlah di tiap pil status mengikuti pencarian dan kelas yang sedang dipilih.
 */
export function StudentTaskList({ rows }: { rows: StudentTaskRow[] }) {
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState(ALL);
  const [status, setStatus] = useState<TaskStatusFilter>(ALL);

  const classes = useMemo(
    () => [...new Map(rows.map((row) => [row.classId, row.className])).entries()],
    [rows],
  );
  const groups = useMemo(
    () => groupTasks(filterTasks(rows, { query, classId })),
    [rows, query, classId],
  );
  const total = groups.todo.length + groups.waiting.length + groups.graded.length;
  const filtering = query.trim() !== "" || classId !== ALL || status !== ALL;
  // Tanpa penyaringan, "Perlu dikerjakan" tetap tampil walau kosong (kabar baik); selebihnya
  // hanya kelompok yang berisi.
  const shown = GROUPS.filter(
    ({ key }) =>
      (status === ALL || status === key) &&
      (groups[key].length > 0 || (!filtering && key === "todo")),
  );

  function reset() {
    setQuery("");
    setClassId(ALL);
    setStatus(ALL);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <SearchInput
              aria-label="Cari tugas"
              placeholder="Cari tugas atau kelas"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {classes.length > 1 ? (
            <NativeSelect
              aria-label="Saring menurut kelas"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="sm:w-64"
            >
              <option value={ALL}>Semua kelas</option>
              {classes.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          ) : null}
        </div>
        <FilterPills
          label="Saring menurut status"
          value={status}
          onChange={setStatus}
          options={[
            { value: ALL, label: "Semua", count: total },
            ...GROUPS.map(({ key, pill }) => ({
              value: key,
              label: pill,
              count: groups[key].length,
            })),
          ]}
        />
      </div>

      {shown.length ? (
        shown.map(({ key, title, hint }) => (
          <TaskGroup key={key} id={key} title={title} hint={hint} rows={groups[key]} />
        ))
      ) : (
        <EmptyState
          title="Tidak ada tugas yang cocok"
          caption="Coba kata kunci lain, atau tampilkan kembali semua kelas dan status."
          action={
            <Button type="button" variant="outline" onClick={reset}>
              Reset pencarian
            </Button>
          }
        />
      )}
    </div>
  );
}
