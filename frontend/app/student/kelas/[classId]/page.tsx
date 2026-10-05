import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  LibraryBig,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentStatusBadge } from "@/components/student/AssignmentStatusBadge";
import { AnnouncementList } from "@/components/common/AnnouncementList";
import { StudentUpdates } from "@/components/student/StudentUpdates";
import { MaterialIcon } from "@/components/materials/MaterialIcon";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { academicLabel, distinctSubject } from "@/lib/academic";
import { getClassAnnouncements, getStudentClasses, getStudentMaterials } from "@/lib/data";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import { describeSource } from "@/lib/materials";
import type { StudentClassWithAssignments } from "@/lib/types";

export default async function StudentClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ classId }, query] = await Promise.all([params, searchParams]);
  const [classes, materials] = await Promise.all([getStudentClasses(), getStudentMaterials()]);
  const current = classes.find((studentClass) => studentClass.id === classId);
  if (!current) notFound();
  const announcements = await getClassAnnouncements(classId);

  const ownMaterials = materials
    .filter((material) => material.class_id === classId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const assignments = [...current.assignments].sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
  const openCount = assignments.filter((assignment) => !assignment.submission || assignment.submission.status === "draft").length;
  const assignmentRefs = assignments.map(({ id, title }) => ({ id, title }));
  const classMeta = [distinctSubject(current.name, current.subject), academicLabel(current)].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5 sm:space-y-6">
      <nav aria-label="Lokasi halaman" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Link href="/student" className="hover:text-primary">Beranda</Link><ChevronRight className="h-3.5 w-3.5" />
        <Link href="/student/kelas" className="hover:text-primary">Kelas</Link><ChevronRight className="h-3.5 w-3.5" />
        <span aria-current="page" className="truncate text-foreground">{current.name}</span>
      </nav>

      <section className="rounded-xl border border-border bg-card px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground sm:h-14 sm:w-14"><BookOpen className="h-6 w-6" /></span>
            <div className="min-w-0">

              <h1 className="mt-1 text-[1.65rem] font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-[2rem]">{current.name}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{classMeta}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground"><GraduationCap className="h-4 w-4 text-accent-foreground" />{current.teacher_name}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-foreground">{ownMaterials.length} materi</span>
            <span className="rounded-full bg-brand-pink px-3 py-1.5 text-xs font-semibold text-danger">{openCount} tugas aktif</span>
          </div>
        </div>
      </section>

      <Tabs key={query.tab || "ringkasan"} defaultValue={["materi", "tugas", "pengumuman"].includes(query.tab ?? "") ? query.tab : "ringkasan"} className="space-y-4">
        <TabsList aria-label="Bagian kelas" className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5 shadow-sm sm:w-fit">
          <TabsTrigger value="ringkasan" className="gap-2 rounded-xl px-3.5 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm"><BookOpen className="h-4 w-4" />Ringkasan</TabsTrigger>
          <TabsTrigger value="materi" className="gap-2 rounded-xl px-3.5 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm"><LibraryBig className="h-4 w-4" />Materi</TabsTrigger>
          <TabsTrigger value="tugas" className="gap-2 rounded-xl px-3.5 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm"><ClipboardList className="h-4 w-4" />Tugas</TabsTrigger>
          <TabsTrigger value="pengumuman" className="gap-2 rounded-xl px-3.5 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-sm"><MessageSquareText className="h-4 w-4" />Pengumuman</TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan" className="mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,.8fr)]">
            <Card className="rounded-xl border-border bg-card p-5 shadow-none sm:p-6">

              <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-foreground">Ringkasan kelas</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Pilih tab Materi, Tugas, atau Pengumuman untuk melihat isi kelas.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <InfoTile icon={GraduationCap} label="Pengajar" value={current.teacher_name} />
                <InfoTile icon={LibraryBig} label="Materi tersedia" value={`${ownMaterials.length} materi`} />
                <InfoTile icon={ClipboardList} label="Tugas aktif" value={`${openCount} tugas`} />
              </div>
            </Card>
            <NextAssignment assignments={assignments} />
          </div>
          <StudentUpdates classId={classId} assignmentRefs={assignmentRefs} title="Kabar terbaru di kelas ini" compact />
        </TabsContent>

        <TabsContent value="materi" className="mt-0">
          <Card className="overflow-hidden rounded-xl border-border bg-card shadow-none">
            <div className="border-b border-border/80 px-5 py-4 sm:px-6">

              <h2 className="mt-1 text-lg font-semibold text-foreground">Materi kelas</h2>
            </div>
            {ownMaterials.length ? (
              <ul className="divide-y divide-border/70">
                {ownMaterials.map((material) => {
                  const source = describeSource(material.url);
                  return (
                    <li key={material.id} id={`materi-${material.id}`} className="flex gap-3.5 px-5 py-4 sm:px-6">
                      <MaterialIcon kind={source.kind} />
                      <div className="min-w-0 flex-1">
                        {material.topic ? <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-accent-foreground">{material.topic}</p> : null}
                        <h3 className="mt-0.5 font-bold text-foreground">{material.title}</h3>
                        {material.description ? <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{material.description}</p> : null}
                        <p className="mt-2 text-xs text-muted-foreground">{source.label} <span className="mx-1">·</span> {formatDate(material.created_at)}</p>
                      </div>
                      {material.url ? <a href={material.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 self-center rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground hover:border-primary/40 hover:text-primary">Buka<ExternalLink className="h-3.5 w-3.5" /><span className="sr-only"> {material.title}</span></a> : null}
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyPanel title="Belum ada materi" text="Materi yang dibagikan dosen akan muncul di sini." />}
          </Card>
        </TabsContent>

        <TabsContent value="tugas" className="mt-0">
          <Card className="overflow-hidden rounded-xl border-border bg-card shadow-none">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/80 px-5 py-4 sm:px-6">
              <div><h2 className="mt-1 text-lg font-semibold text-foreground">Tugas kelas</h2></div>
              <Link href="/student/tugas" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">Semua tugas <ArrowRight className="h-4 w-4" /></Link>
            </div>
            {assignments.length ? (
              <ul className="divide-y divide-border/70">
                {assignments.map((assignment) => (
                  <li key={assignment.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-accent-foreground"><ClipboardList className="h-4 w-4" /></span>
                      <div className="min-w-0"><h3 className="font-bold text-foreground">{assignment.title}</h3><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />{assignment.deadline ? `Tenggat ${formatDate(assignment.deadline)} · ${formatRelativeTime(assignment.deadline)}` : "Tanpa tenggat"}</p></div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pl-12 sm:justify-end sm:pl-0"><AssignmentStatusBadge submission={assignment.submission} /><Link href={`/student/submit/${assignment.id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold text-primary hover:bg-secondary">Detail<ArrowRight className="h-3.5 w-3.5" /></Link></div>
                  </li>
                ))}
              </ul>
            ) : <EmptyPanel title="Belum ada tugas" text="Tugas yang diberikan dosen akan muncul di bagian ini." />}
          </Card>
        </TabsContent>

        <TabsContent value="pengumuman" className="mt-0">
          <AnnouncementList announcements={announcements} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoTile({ label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="rounded-xl bg-background px-3.5 py-3"><p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-sm font-bold text-foreground">{value}</p></div>;
}

function NextAssignment({ assignments }: { assignments: StudentClassWithAssignments["assignments"] }) {
  const next = assignments.find((assignment) => !assignment.submission || assignment.submission.status === "draft");
  const submittedCount = assignments.filter((assignment) => assignment.submission?.status === "submitted").length;
  return (
    <Card className="rounded-xl border-border bg-card p-5 text-foreground shadow-none sm:p-6">

      {next ? <><h2 className="mt-2 text-lg font-semibold">{next.title}</h2><p className="mt-1 text-sm text-muted-foreground">{next.deadline ? `Tenggat ${formatRelativeTime(next.deadline)}` : "Tugas dari dosen"}</p><Link href={`/student/submit/${next.id}`} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-brand-teal-light">Buka tugas <ArrowRight className="h-3.5 w-3.5" /></Link></> : <><h2 className="mt-2 text-lg font-semibold">{submittedCount ? "Semua tugas sudah dikumpulkan" : "Belum ada tugas aktif"}</h2><p className="mt-1 text-sm text-muted-foreground">{submittedCount ? "Nilai dan umpan balik akan muncul setelah dosen meninjau jawabanmu." : "Kamu bisa mulai dengan mempelajari materi kelas dari tab Materi."}</p></>}
    </Card>
  );
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return <div className="px-5 py-10 text-center"><BookOpen className="mx-auto h-6 w-6 text-accent-foreground" /><h3 className="mt-2 font-bold text-foreground">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>;
}
