import { BookOpen, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnnouncementList } from "@/components/common/AnnouncementList";
import { BackLink } from "@/components/common/BackLink";
import { AnnouncementForm } from "@/components/dashboard/AnnouncementForm";
import { AssignmentSummary } from "@/components/dashboard/AssignmentSummary";
import { ClassRoster } from "@/components/dashboard/ClassRoster";
import { ClassSectionTabs, type ClassSection } from "@/components/dashboard/ClassSectionTabs";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmissionTable } from "@/components/dashboard/SubmissionTable";
import { TeacherAssignmentList } from "@/components/dashboard/TeacherAssignmentList";
import { ClassMaterialBrowser } from "@/components/materials/ClassMaterialBrowser";
import { Button } from "@/components/ui/button";
import { academicLabel } from "@/lib/academic";
import { getAssignments, getClassAnnouncements, getClassMaterials, getClassRoster, getClasses, getSubmissions } from "@/lib/data";

export default async function ClassDetailPage({ params, searchParams }: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ assignment?: string; tab?: string; filter?: string }>;
}) {
  const [{ classId }, query] = await Promise.all([params, searchParams]);
  const classes = await getClasses();
  const current = classes.find((item) => item.id === classId);
  if (!current) notFound();

  const [assignments, materials, roster, announcements] = await Promise.all([
    getAssignments(classId), getClassMaterials(classId), getClassRoster(classId), getClassAnnouncements(classId),
  ]);
  const section: ClassSection = query.tab === "mahasiswa" || query.tab === "materi" || query.tab === "pengumuman" || query.tab === "tugas"
    ? query.tab : query.assignment ? "tugas" : "mahasiswa";
  const selected = section === "tugas" ? assignments.find((item) => item.id === query.assignment) : undefined;
  const submissions = selected ? await getSubmissions(selected.id) : [];

  return (
    <div className="space-y-5">
      <BackLink href="/dashboard/classes" label="Kembali ke kelas" />
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><BookOpen className="h-6 w-6" /></span>
            <div className="min-w-0">
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.15em] text-accent-foreground">Ruang kelas · {academicLabel(current)}</p>
              <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{current.name}</h1>
              <p className="mt-2 text-xs text-muted-foreground">Kode gabung <span className="ml-1 rounded-md border border-border bg-white/70 px-2 py-1 font-mono font-bold tracking-wider text-primary">{current.join_code}</span></p>
            </div>
          </div>
          <Button asChild className="shrink-0 rounded-xl">
            <Link href={`/dashboard/classes/${classId}/assignments/new`}><Plus className="mr-1.5 h-4 w-4" />Buat tugas</Link>
          </Button>
        </div>
      </section>
      <ClassSectionTabs classId={classId} active={section} counts={{ mahasiswa: roster.length, materi: materials.length, pengumuman: announcements.length, tugas: assignments.length }} />

      {section === "mahasiswa" ? <ClassRoster students={roster} /> : null}
      {section === "materi" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold">Materi kelas</h2><p className="mt-1 text-sm text-muted-foreground">Susun bahan belajar menurut topik atau pertemuan.</p></div>
            <Button asChild variant="outline"><Link href={`/dashboard/classes/${classId}/materials/new`}>Bagikan materi</Link></Button>
          </div>
          {materials.length ? <ClassMaterialBrowser materials={materials} now={Date.now()} manage /> : <EmptyState title="Belum ada materi" caption="Bagikan bacaan, slide, atau video menggunakan tombol Bagikan materi." />}
        </div>
      ) : null}
      {section === "pengumuman" ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <AnnouncementForm classId={classId} />
          <div><h2 className="mb-3 text-lg font-semibold">Pengumuman kelas</h2><AnnouncementList announcements={announcements} /></div>
        </div>
      ) : null}
      {section === "tugas" && !selected ? (
        <TeacherAssignmentList assignments={assignments.map((item) => ({ ...item, class_name: current.name, subject: current.subject }))} showClass={false} />
      ) : null}
      {selected ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackLink href={`/dashboard/classes/${classId}?tab=tugas`} label="Semua tugas kelas" />
            <Button asChild variant="outline"><Link href={`/dashboard/classes/${classId}/assignments/${selected.id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit tugas</Link></Button>
          </div>
          <AssignmentSummary assignment={selected} />
          {selected.instructions ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold">Instruksi tugas</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{selected.instructions}</p>
            </div>
          ) : null}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Pengumpulan mahasiswa</h2>
            <SubmissionTable key={selected.id} submissions={submissions} initialFilter={query.filter === "needs_review" && selected.needs_review_count ? "needs_review" : "all"} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
