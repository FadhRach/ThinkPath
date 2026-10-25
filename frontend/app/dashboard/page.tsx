import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { UpcomingDeadlines } from "@/features/assignments/components/UpcomingDeadlines";
import { TeacherClassCard } from "@/features/classes/components/TeacherClassCard";
import { CekPahamCard } from "@/features/home/components/CekPahamCard";
import { ClassCarousel } from "@/features/home/components/ClassCarousel";
import { ForumFeedCard } from "@/features/home/components/ForumFeedCard";
import { HomeHeader } from "@/features/home/components/HomeHeader";
import { QuickCreateCard } from "@/features/home/components/QuickCreateCard";
import { ReviewQueueCard } from "@/features/home/components/ReviewQueueCard";
import {
  getAllAssignments,
  getCekPahamQueue,
  getClasses,
  getForumsOf,
  getMe,
  getTeacherSubmissions,
} from "@/lib/data";

export default async function TeacherDashboardPage() {
  // Hanya profil dan kelas yang wajib; kartu pelengkap tidak boleh merobohkan beranda.
  const [me, classes, assignments, submissions, cekpaham] = await Promise.all([
    getMe(),
    getClasses(),
    getAllAssignments(),
    getTeacherSubmissions("submitted").catch(() => []),
    getCekPahamQueue().catch(() => []),
  ]);
  const forum = await getForumsOf(classes.map((klass) => klass.id));

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <HomeHeader
          firstName={me.display_name || me.email.split("@")[0]}
          classCount={classes.length}
          classLabel="kelas diampu"
        />
        <QuickCreateCard />
      </header>

      {/* Dua baris. Baris 1: kelas (kolom 1-2, menggulir ke samping) dan Cek Paham (kolom 3). Baris 2:
          antrean periksa, tenggat, dan forum, tingginya tetap dan isinya menggulir ke bawah, sehingga
          antrean atau forum yang membludak tidak mengubah tata letak. */}
      <div className="grid gap-x-6 gap-y-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_22rem] xl:grid-rows-[auto_36rem]">
        <section aria-labelledby="my-classes-heading" className="min-w-0 xl:col-span-2">
          <h2 id="my-classes-heading" className="mb-3 text-heading font-semibold">
            Kelas yang Anda ajar
          </h2>
          {classes.length ? (
            <ClassCarousel label="Kelas yang Anda ajar">
              {classes.map((klass) => (
                <TeacherClassCard key={klass.id} studentClass={klass} assignments={assignments} />
              ))}
            </ClassCarousel>
          ) : (
            <EmptyState
              title="Belum ada kelas"
              caption="Buat kelas, lalu bagikan kode undangan kepada mahasiswa."
              action={
                <Button asChild>
                  <Link href="/dashboard/classes/new">Buat kelas</Link>
                </Button>
              }
            />
          )}
        </section>
        <section aria-labelledby="cekpaham-heading" className="flex min-w-0 flex-col">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="cekpaham-heading" className="text-heading font-semibold">
              Cek Paham
            </h2>
            <Link
              href="/dashboard/cekpaham"
              className="text-sm font-medium text-brand-ink hover:underline"
            >
              Buka
            </Link>
          </div>
          <div className="min-h-0 flex-1">
            <CekPahamCard rows={cekpaham} />
          </div>
        </section>

        <div className="min-w-0 xl:min-h-0">
          <ReviewQueueCard submissions={submissions} />
        </div>
        <div className="min-w-0 xl:min-h-0">
          <UpcomingDeadlines assignments={assignments} />
        </div>
        <div className="min-w-0 xl:min-h-0">
          <ForumFeedCard
            posts={forum}
            title="Forum terbaru"
            href="/dashboard/forum"
            classBase="/dashboard/classes"
            fill
          />
        </div>
      </div>
    </div>
  );
}
