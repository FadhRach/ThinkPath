import { BookOpen, CheckCircle2, GraduationCap, Star } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { FocusBanner } from "@/components/shared/FocusBanner";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { StatCard } from "@/components/shared/StatCard";
import { Card } from "@/components/ui/card";
import { firstNameOf, summarizeStudentHome } from "@/features/assignments/lib/student-home";
import { JoinCodeForm } from "@/features/classes/components/JoinCodeForm";
import { StudentClassOverviewCard } from "@/features/classes/components/StudentClassOverviewCard";
import { StudentUpdates } from "@/features/notifications/components/StudentUpdates";
import { RecentGrades } from "@/features/submissions/components/RecentGrades";
import { getMe, getStudentClasses } from "@/lib/data";
import { formatDate, formatDateLong } from "@/lib/formatting";

export default async function StudentPage() {
  const [me, classes] = await Promise.all([getMe(), getStudentClasses()]);
  const { assignments, pending, averageGrade, nextTask, recentGrades } =
    summarizeStudentHome(classes);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-title font-medium text-foreground sm:text-4xl">
            Hai, {firstNameOf(me.display_name || me.email)}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {formatDateLong()}
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            {pending.length
              ? `${pending.length} tugas belum dikumpulkan`
              : "Tidak ada tugas yang belum dikumpulkan"}
          </p>
        </div>
        <Link
          href="/student/tugas"
          className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
        >
          Lihat semua tugas <span aria-hidden="true">→</span>
        </Link>
      </header>

      <div
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        role="group"
        aria-label="Ringkasan belajar"
      >
        <StatCard stackOnMobile icon={BookOpen} label="Tugas aktif" value={pending.length} />
        <StatCard
          stackOnMobile
          icon={CheckCircle2}
          label="Tugas selesai"
          value={assignments.length - pending.length}
        />
        <StatCard stackOnMobile icon={Star} label="Rata-rata nilai" value={averageGrade ?? "–"} />
        <StatCard stackOnMobile icon={GraduationCap} label="Kelas diikuti" value={classes.length} />
      </div>

      <FocusBanner
        title={nextTask ? `${pending.length} tugas menunggu diselesaikan.` : "Semua tugasmu aman."}
        description={
          nextTask
            ? `${nextTask.title} · ${nextTask.className} · ${nextTask.deadline ? `Tenggat ${formatDate(nextTask.deadline)}` : "Tanpa tenggat"}`
            : "Kamu bisa gunakan waktu untuk membaca materi atau melihat kelas yang tersedia."
        }
        href={nextTask ? `/student/submit/${nextTask.id}` : "/student/kelas"}
        linkLabel={
          nextTask ? (nextTask.submission ? "Lanjutkan tugas" : "Kerjakan tugas") : "Lihat kelas"
        }
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-10">
        <section aria-labelledby="my-classes-heading" className="min-w-0">
          <SectionHeading
            id="my-classes-heading"
            title="Kelas saya"
            href="/student/kelas"
            linkLabel="Daftar kelas"
          />
          <div className="space-y-5">
            {classes.length === 0 ? (
              <EmptyState
                title="Belum bergabung dengan kelas"
                caption="Masukkan kode dari dosen di formulir Gabung kelas. Materi dan tugas kelas akan muncul di sini."
              />
            ) : (
              classes.map((classroom) => (
                <StudentClassOverviewCard key={classroom.id} classroom={classroom} />
              ))
            )}
          </div>
        </section>

        <aside className="min-w-0 space-y-6">
          <StudentUpdates compact title="Pengumuman kelas" />
          <RecentGrades items={recentGrades} />
          <Card className="p-5">
            <h2 className="font-semibold">Gabung kelas</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Gunakan kode undangan dari dosen.
            </p>
            <JoinCodeForm />
          </Card>
        </aside>
      </div>
    </div>
  );
}
