import { BookOpen, ClipboardCheck, FileCheck2 } from "lucide-react";
import Link from "next/link";

import { FocusBanner } from "@/components/shared/FocusBanner";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { UpcomingDeadlines } from "@/features/assignments/components/UpcomingDeadlines";
import { TeacherClassList } from "@/features/classes/components/TeacherClassList";
import { getAllAssignments, getClasses, getMe } from "@/lib/data";
import { formatDateLong } from "@/lib/formatting";

export default async function TeacherDashboardPage() {
  const [me, classes, assignments] = await Promise.all([
    getMe(),
    getClasses(),
    getAllAssignments(),
  ]);
  const pending = assignments.reduce((sum, item) => sum + item.needs_review_count, 0);
  const submissions = assignments.reduce((sum, item) => sum + item.submission_count, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-title font-bold sm:text-4xl">
            Selamat datang, {me.display_name || me.email.split("@")[0]}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {formatDateLong()} ·{" "}
            {pending
              ? `${pending} pengumpulan menunggu diperiksa`
              : "Tidak ada pengumpulan yang menunggu diperiksa"}
          </p>
        </div>
        <Button asChild className="w-fit">
          <Link href="/dashboard/tugas/new">Buat tugas</Link>
        </Button>
      </header>

      <div
        className="grid gap-3 sm:grid-cols-3 sm:gap-4"
        role="group"
        aria-label="Ringkasan mengajar"
      >
        <StatCard icon={BookOpen} label="Kelas yang diajar" value={classes.length} />
        <StatCard icon={ClipboardCheck} label="Perlu diperiksa" value={pending} />
        <StatCard icon={FileCheck2} label="Total pengumpulan" value={submissions} />
      </div>

      <FocusBanner
        title={
          pending
            ? `${pending} pengumpulan menunggu diperiksa.`
            : "Semua pengumpulan sudah diperiksa."
        }
        description={
          pending
            ? "Berikan nilai dan umpan balik agar mahasiswa bisa melanjutkan belajarnya."
            : "Gunakan waktu untuk menyiapkan materi atau tugas berikutnya untuk kelas Anda."
        }
        href={
          pending
            ? "/dashboard/pengumpulan"
            : classes.length
              ? "/dashboard/classes"
              : "/dashboard/classes/new"
        }
        linkLabel={pending ? "Periksa pengumpulan" : classes.length ? "Lihat kelas" : "Buat kelas"}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-10">
        <section className="min-w-0">
          <SectionHeading
            title="Kelas yang Anda ajar"
            href="/dashboard/classes"
            linkLabel="Semua kelas"
          />
          <TeacherClassList classes={classes} assignments={assignments} />
        </section>

        <aside className="space-y-6">
          <UpcomingDeadlines assignments={assignments} />
          <section className="border-t border-border pt-5">
            <h2 className="font-semibold">Perkembangan kelas</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Lihat hasil analisis jawaban dan perkembangan pemahaman mahasiswa.
            </p>
            <Link
              href="/dashboard/overview"
              className="mt-3 inline-block text-sm font-medium text-brand-ink hover:underline"
            >
              Buka analisis →
            </Link>
          </section>
          <Button asChild variant="outline">
            <Link href="/dashboard/pengumpulan">Periksa pengumpulan</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
