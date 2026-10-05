import { BookOpen, CheckCircle2, GraduationCap, Star } from "lucide-react";
import Link from "next/link";

import { StatCard } from "@/components/common/StatCard";
import { TaskIndicator } from "@/components/common/TaskIndicator";
import { JoinCodeForm } from "@/components/student/JoinCodeForm";
import { StudentUpdates } from "@/components/student/StudentUpdates";
import { Card } from "@/components/ui/card";
import { academicLabel } from "@/lib/academic";
import { getMe, getStudentClasses } from "@/lib/data";
import { formatDate, formatDateLong } from "@/lib/formatting";

function getFirstName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]) ? name : parts[0] || name;
}

export default async function StudentPage() {
  const [me, classes] = await Promise.all([getMe(), getStudentClasses()]);
  const firstName = getFirstName(me.display_name || me.email);
  const assignments = classes.flatMap((classroom) =>
    classroom.assignments.map((assignment) => ({ ...assignment, className: classroom.name })),
  );
  const pending = assignments.filter((item) => !item.submission || item.submission.status === "draft");
  const reviewed = assignments.filter((item) => item.submission?.status === "reviewed");
  const graded = reviewed.filter((item) => typeof item.submission?.grade === "number");
  const averageGrade = graded.length
    ? Math.round((graded.reduce((sum, item) => sum + item.submission!.grade!, 0) / graded.length) * 10) / 10
    : null;
  const nextTask = [...pending].sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))[0];
  const recentGrades = graded
    .sort((a, b) => (b.submission?.submitted_at ?? "").localeCompare(a.submission?.submitted_at ?? ""))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Hai, {firstName}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {formatDateLong()}<span className="mx-2" aria-hidden="true">·</span>
            {pending.length ? `${pending.length} tugas belum dikumpulkan` : "Tidak ada tugas yang belum dikumpulkan"}
          </p>
        </div>
        <Link href="/student/tugas" className="text-sm font-semibold text-accent-foreground underline-offset-4 hover:underline">
          Lihat semua tugas <span aria-hidden="true">→</span>
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" role="group" aria-label="Ringkasan belajar">
        <StatCard stackOnMobile icon={BookOpen} label="Tugas aktif" value={pending.length} />
        <StatCard stackOnMobile icon={CheckCircle2} label="Tugas selesai" value={assignments.length - pending.length} />
        <StatCard stackOnMobile icon={Star} label="Rata-rata nilai" value={averageGrade ?? "–"} />
        <StatCard stackOnMobile icon={GraduationCap} label="Kelas diikuti" value={classes.length} />
      </div>

      <TaskIndicator
        title={nextTask ? `${pending.length} tugas menunggu diselesaikan.` : "Semua tugasmu aman."}
        description={nextTask
          ? `${nextTask.title} · ${nextTask.className} · ${nextTask.deadline ? `Tenggat ${formatDate(nextTask.deadline)}` : "Tanpa tenggat"}`
          : "Kamu bisa gunakan waktu untuk membaca materi atau melihat kelas yang tersedia."}
        href={nextTask ? `/student/submit/${nextTask.id}` : "/student/kelas"}
        linkLabel={nextTask ? nextTask.submission ? "Lanjutkan tugas" : "Kerjakan tugas" : "Lihat kelas"}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-10">
        <section aria-labelledby="my-classes-heading" className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="my-classes-heading" className="text-xl font-semibold">Kelas saya</h2>
            <Link href="/student/kelas" className="text-sm text-accent-foreground underline-offset-4 hover:underline">Daftar kelas <span aria-hidden="true">→</span></Link>
          </div>
          <div className="space-y-5">
            {classes.length === 0 ? (
              <Card className="p-6">
                <h3 className="font-semibold">Belum bergabung dengan kelas</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Masukkan kode dari dosen di formulir Gabung kelas. Materi dan tugas kelas akan muncul di sini.</p>
              </Card>
            ) : classes.map((classroom) => {
              const active = classroom.assignments
                .filter((item) => !item.submission || item.submission.status === "draft")
                .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
              const visible = active.length ? active.slice(0, 3) : classroom.assignments.slice(0, 2);
              return (
                <Card key={classroom.id} className="overflow-hidden">
                  <div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:px-6">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold"><Link href={`/student/kelas/${classroom.id}`} className="hover:underline underline-offset-4">{classroom.name}</Link></h3>
                      <p className="mt-1 text-sm text-muted-foreground">{classroom.teacher_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{academicLabel(classroom)}</p>
                    </div>
                    <Link href={`/student/kelas/${classroom.id}?tab=materi`} className="shrink-0 text-sm text-accent-foreground underline-offset-4 hover:underline">Materi kelas <span aria-hidden="true">→</span></Link>
                  </div>
                  <div className="divide-y divide-border">
                    {visible.length ? visible.map((assignment) => {
                      const unfinished = !assignment.submission || assignment.submission.status === "draft";
                      const overdue = unfinished && assignment.deadline && new Date(assignment.deadline).getTime() < Date.now();
                      return (
                        <div key={assignment.id} className="flex flex-col justify-between gap-3 px-5 py-5 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
                          <div className="min-w-0">
                            <Link href={`/student/submit/${assignment.id}`} className="font-medium leading-relaxed hover:underline underline-offset-4">{assignment.title}</Link>
                            <p className={`mt-1.5 text-xs ${overdue ? "text-danger" : "text-muted-foreground"}`}>
                              {unfinished ? assignment.deadline ? `${overdue ? "Lewat tenggat" : "Tenggat"} ${formatDate(assignment.deadline)}` : "Tanpa tenggat" : assignment.submission?.status === "reviewed" ? "Sudah dinilai" : "Menunggu penilaian dosen"}
                            </p>
                          </div>
                          <Link href={`/student/submit/${assignment.id}`} className={unfinished ? "inline-flex w-fit shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-brand-teal-light" : "shrink-0 text-sm font-medium text-accent-foreground underline-offset-4 hover:underline"}>
                            {unfinished ? assignment.submission ? "Lanjutkan" : "Kerjakan" : "Lihat jawaban"}<span className="ml-2" aria-hidden="true">→</span>
                          </Link>
                        </div>
                      );
                    }) : <p className="px-6 py-6 text-sm text-muted-foreground">Dosen belum membagikan tugas di kelas ini.</p>}
                  </div>
                  {active.length > 3 ? <Link href={`/student/kelas/${classroom.id}?tab=tugas`} className="block border-t border-border px-6 py-3 text-sm text-accent-foreground hover:underline">Lihat {active.length - 3} tugas lainnya →</Link> : null}
                </Card>
              );
            })}
          </div>
        </section>

        <aside className="min-w-0 space-y-6">
          <StudentUpdates compact title="Pengumuman kelas" />
          <section aria-labelledby="recent-grades-heading" className="border-t border-border pt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="recent-grades-heading" className="font-semibold">Nilai terbaru</h2>
              <Link href="/student/progress" className="text-sm text-accent-foreground hover:underline">Progres →</Link>
            </div>
            {recentGrades.length ? (
              <ul className="mt-3 divide-y divide-border">
                {recentGrades.map((assignment) => (
                  <li key={assignment.id} className="flex items-start gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/student/submit/${assignment.id}`} className="line-clamp-2 text-sm font-medium leading-relaxed hover:underline">{assignment.title}</Link>
                      <p className="mt-1 text-xs text-muted-foreground">{assignment.className}</p>
                    </div>
                    <p className="shrink-0 text-lg font-semibold tabular-nums">{assignment.submission!.grade}<span className="ml-1 text-xs font-normal text-muted-foreground">/100</span></p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Nilai akan muncul setelah dosen memeriksa jawabanmu.</p>}
          </section>
          <Card className="p-5">
            <h2 className="font-semibold">Gabung kelas</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Gunakan kode undangan dari dosen.</p>
            <JoinCodeForm />
          </Card>
        </aside>
      </div>
    </div>
  );
}
