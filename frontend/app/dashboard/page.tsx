import { BookOpen, ClipboardCheck, FileCheck2 } from "lucide-react";
import Link from "next/link";

import { StatCard } from "@/components/common/StatCard";
import { TaskIndicator } from "@/components/common/TaskIndicator";
import { TeacherSectionHeading } from "@/components/dashboard/TeacherUi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { academicLabel } from "@/lib/academic";
import { getAllAssignments, getClasses, getMe } from "@/lib/data";
import { formatDate, formatDateLong } from "@/lib/formatting";

export default async function TeacherDashboardPage() {
  const [me, classes, assignments] = await Promise.all([getMe(), getClasses(), getAllAssignments()]);
  const pending = assignments.reduce((sum, item) => sum + item.needs_review_count, 0);
  const submissions = assignments.reduce((sum, item) => sum + item.submission_count, 0);
  const upcoming = assignments
    .filter((item) => item.deadline && new Date(item.deadline).getTime() > Date.now())
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    .slice(0, 4);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Selamat datang, {me.display_name || me.email.split("@")[0]}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{formatDateLong()} · {pending ? `${pending} pengumpulan menunggu diperiksa` : "Tidak ada pengumpulan yang menunggu diperiksa"}</p>
        </div>
        <Button asChild className="h-10 w-fit"><Link href="/dashboard/tugas/new">Buat tugas</Link></Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4" role="group" aria-label="Ringkasan mengajar">
        <StatCard icon={BookOpen} label="Kelas yang diajar" value={classes.length} />
        <StatCard icon={ClipboardCheck} label="Perlu diperiksa" value={pending} />
        <StatCard icon={FileCheck2} label="Total pengumpulan" value={submissions} />
      </div>

      <TaskIndicator
        title={pending ? `${pending} pengumpulan menunggu diperiksa.` : "Semua pengumpulan sudah diperiksa."}
        description={pending
          ? "Berikan nilai dan umpan balik agar mahasiswa bisa melanjutkan belajarnya."
          : "Gunakan waktu untuk menyiapkan materi atau tugas berikutnya untuk kelas Anda."}
        href={pending ? "/dashboard/pengumpulan" : classes.length ? "/dashboard/classes" : "/dashboard/classes/new"}
        linkLabel={pending ? "Periksa pengumpulan" : classes.length ? "Lihat kelas" : "Buat kelas"}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-10">
        <section className="min-w-0">
          <TeacherSectionHeading title="Kelas yang Anda ajar" href="/dashboard/classes" linkLabel="Semua kelas" />
          <Card className="overflow-hidden">
            {classes.length ? (
              <ul className="divide-y divide-border">
                {classes.map((classroom) => {
                  const own = assignments.filter((item) => item.class_id === classroom.id);
                  const waiting = own.reduce((sum, item) => sum + item.needs_review_count, 0);
                  return (
                    <li key={classroom.id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                      <div className="min-w-0">
                        <Link href={`/dashboard/classes/${classroom.id}`} className="text-lg font-semibold underline-offset-4 hover:underline">{classroom.name}</Link>
                        <p className="mt-1 text-sm text-muted-foreground">{academicLabel(classroom)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{classroom.assignment_count} tugas · Kode kelas <span className="font-mono text-foreground">{classroom.join_code}</span></p>
                      </div>
                      <div className="shrink-0 sm:text-right">
                        <p className={`text-sm ${waiting ? "font-medium text-danger" : "text-muted-foreground"}`}>{waiting ? `${waiting} perlu diperiksa` : "Tidak ada pengumpulan baru"}</p>
                        <Link href={`/dashboard/classes/${classroom.id}`} className="mt-2 inline-block text-sm font-medium text-accent-foreground hover:underline">Buka kelas →</Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <div className="p-6"><h3 className="font-semibold">Belum ada kelas</h3><p className="mt-2 text-sm text-muted-foreground">Buat kelas, lalu bagikan kode undangan kepada mahasiswa.</p><Link href="/dashboard/classes/new" className="mt-4 inline-block text-sm font-medium text-accent-foreground hover:underline">Buat kelas →</Link></div>}
          </Card>
        </section>

        <aside className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold">Tenggat terdekat</h2>
            <div className="mt-2 divide-y divide-border">
              {upcoming.length ? upcoming.map((item) => (
                <Link key={item.id} href={`/dashboard/classes/${item.class_id}?tab=tugas&assignment=${item.id}`} className="block py-4 underline-offset-4 hover:underline">
                  <p className="text-xs text-muted-foreground">{formatDate(item.deadline)}</p>
                  <h3 className="mt-1 text-sm font-medium leading-relaxed">{item.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.class_name}</p>
                </Link>
              )) : <p className="py-4 text-sm text-muted-foreground">Belum ada tenggat mendatang.</p>}
            </div>
          </section>
          <section className="border-t border-border pt-5">
            <h2 className="font-semibold">Perkembangan kelas</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Lihat hasil analisis jawaban dan perkembangan pemahaman mahasiswa.</p>
            <Link href="/dashboard/overview" className="mt-3 inline-block text-sm font-medium text-accent-foreground hover:underline">Buka analisis →</Link>
          </section>
          <Button asChild variant="outline" className="h-10"><Link href="/dashboard/pengumpulan">Periksa pengumpulan</Link></Button>
        </aside>
      </div>
    </div>
  );
}
