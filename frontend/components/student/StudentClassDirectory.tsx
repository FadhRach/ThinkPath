"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { StudentClassCard } from "@/components/student/StudentClassCard";
import { Input } from "@/components/ui/input";
import type { StudentClassWithAssignments } from "@/lib/types";

export function StudentClassDirectory({
  classes,
}: {
  classes: StudentClassWithAssignments[];
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id");
    if (!normalized) return classes;
    return classes.filter((studentClass) =>
      [studentClass.name, studentClass.subject, studentClass.teacher_name]
        .join(" ")
        .toLocaleLowerCase("id")
        .includes(normalized),
    );
  }, [classes, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{filtered.length}</strong> kelas ditemukan</span>
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama kelas atau dosen"
            aria-label="Cari kelas"
            className="h-11 rounded-xl border-border bg-card pl-9 shadow-sm"
          />
        </label>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((studentClass, index) => (
            <StudentClassCard key={studentClass.id} studentClass={studentClass} index={index} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/65 px-6 py-12 text-center">
          <h2 className="mt-4 font-bold text-foreground">Kelas belum ditemukan</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Coba kata kunci lain, atau gabung kelas menggunakan kode dari dosen di Beranda.
          </p>
        </div>
      )}
    </div>
  );
}
