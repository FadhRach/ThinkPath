import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/common/BackLink";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getClasses } from "@/lib/data";
import { academicLabel } from "@/lib/academic";

export default async function ChooseAssignmentClassPage() {
  const classes = await getClasses();
  return <div className="space-y-5"><BackLink href="/dashboard/tugas" label="Kembali ke tugas" /><PageHeader title="Buat tugas" subtitle="Pilih kelas tujuan untuk tugas baru Anda." />{classes.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{classes.map((item) => <Link key={item.id} href={`/dashboard/classes/${item.id}/assignments/new`} className="group"><Card className="campus-card h-full p-5 transition group-hover:border-primary/40"><BookOpen className="h-6 w-6 text-accent-foreground" /><h2 className="mt-3 text-lg font-semibold">{item.name}</h2><p className="mt-1 text-xs text-muted-foreground">{academicLabel(item)}</p><p className="mt-4 flex items-center gap-1.5 text-xs font-bold text-primary">Pilih kelas<ArrowRight className="h-4 w-4" /></p></Card></Link>)}</div> : <EmptyState title="Buat kelas terlebih dahulu" caption="Tugas akan dibagikan kepada mahasiswa dalam kelas yang Anda pilih." action={<Button asChild><Link href="/dashboard/classes/new">Buat kelas</Link></Button>} />}</div>;
}
