"use client";
import { Search, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AvatarInitials } from "@/components/common/AvatarInitials";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/formatting";
import type { ClassRosterStudent } from "@/lib/types";

export function ClassRoster({ students }: { students: ClassRosterStudent[] }) {
  const [query, setQuery] = useState("");
  const visible = students.filter((student) => student.display_name.toLowerCase().includes(query.trim().toLowerCase()));
  return <Card className="campus-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5"><div><h2 className="font-semibold">Mahasiswa kelas</h2><p className="mt-1 text-xs text-muted-foreground">{students.length} mahasiswa terdaftar</p></div><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama mahasiswa…" aria-label="Cari mahasiswa" /></div></div>{visible.length ? <ul className="divide-y divide-border/70">{visible.map((student) => <li key={student.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5"><div className="flex min-w-0 items-center gap-3"><AvatarInitials name={student.display_name} size="sm" /><div className="min-w-0"><h3 className="font-bold">{student.display_name}</h3><p className="mt-1 text-xs text-muted-foreground">Bergabung {formatDate(student.joined_at)}</p></div></div><div className="flex flex-wrap items-center gap-4 text-xs"><div className="text-muted-foreground"><span className="font-semibold text-foreground">{student.submission_count}</span> dikumpulkan · <span className="font-semibold text-accent-foreground">{student.reviewed_count}</span> dinilai</div><Link href={`/dashboard/students/${student.id}`} className="rounded-lg border border-border px-3 py-2 font-bold text-primary hover:bg-muted">Lihat perkembangan</Link></div></li>)}</ul> : <div className="px-5 py-12 text-center"><Users className="mx-auto h-7 w-7 text-accent-foreground" /><h3 className="mt-3 font-bold">{students.length ? "Nama tidak ditemukan" : "Belum ada mahasiswa"}</h3><p className="mt-1 text-sm text-muted-foreground">{students.length ? "Coba nama atau kata kunci lain." : "Bagikan kode kelas di atas agar mahasiswa dapat bergabung."}</p></div>}</Card>;
}
