"use client";
import { Search } from "lucide-react";
import { useState } from "react";
import { TeacherClassCard } from "@/components/dashboard/TeacherClassCard";
import { Input } from "@/components/ui/input";
import type { ClassSummary, TeacherAssignmentRow } from "@/lib/types";

export function TeacherClassDirectory({ classes, assignments }: { classes: ClassSummary[]; assignments: TeacherAssignmentRow[] }) {
  const [query, setQuery] = useState("");
  const visible = classes.filter((item) => `${item.name} ${item.subject} ${item.program_studi}`.toLocaleLowerCase("id").includes(query.trim().toLocaleLowerCase("id")));
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kelas atau mata kuliah…" aria-label="Cari kelas" className="rounded-xl bg-card pl-9" /></div><p className="text-xs text-muted-foreground" aria-live="polite">{visible.length} kelas ditampilkan</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((item) => <TeacherClassCard key={item.id} studentClass={item} assignments={assignments} index={classes.indexOf(item)} />)}</div>{!visible.length ? <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada kelas yang cocok. Coba kata kunci lain.</p> : null}</div>;
}
