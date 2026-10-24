import { EmptyState } from "@/components/shared/EmptyState";
import { ClassCarousel } from "@/features/home/components/ClassCarousel";
import { ForumFeedCard } from "@/features/home/components/ForumFeedCard";
import { HomeHeader } from "@/features/home/components/HomeHeader";
import { JoinClassCard } from "@/features/home/components/JoinClassCard";
import { TodoCard } from "@/features/home/components/TodoCard";
import { UpcomingCard } from "@/features/home/components/UpcomingCard";
import { firstNameOf, recentGrades } from "@/features/home/lib/home-summary";
import { RecentGrades } from "@/features/submissions/components/RecentGrades";
import { getForumFeed, getMe, getStudentClasses, getStudentSchedule, getTodos } from "@/lib/data";

export default async function StudentHomePage() {
  // Hanya profil dan kelas yang wajib; kartu pelengkap tidak boleh merobohkan beranda.
  const [me, classes, todos, schedule, feed] = await Promise.all([
    getMe(),
    getStudentClasses(),
    getTodos().catch(() => []),
    getStudentSchedule().catch(() => []),
    getForumFeed(20).catch(() => []),
  ]);

  return (
    // Tiga kolom (xl): kelas dan forum melebar di kolom 1-2; kolom 3 membentang dari baris kelas
    // sampai baris forum, sehingga tepi atas dan bawahnya sejajar dengan kartu di kiri.
    <div className="grid gap-x-6 gap-y-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_22rem] xl:grid-rows-[auto_auto_auto_1fr]">
      <div className="xl:col-span-2 xl:row-start-1">
        <HomeHeader
          firstName={firstNameOf(me.display_name || me.email)}
          classCount={classes.length}
        />
      </div>
      <div className="xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:self-end">
        <JoinClassCard />
      </div>

      <h2
        id="my-classes-heading"
        className="mt-2 text-heading font-semibold xl:col-span-2 xl:row-start-2"
      >
        Kelas saya
      </h2>
      <div className="min-w-0 xl:col-span-2 xl:row-start-3">
        {classes.length ? (
          <ClassCarousel classes={classes} />
        ) : (
          <EmptyState
            title="Belum bergabung dengan kelas"
            caption="Masukkan kode undangan dari dosen di kartu Gabung kelas. Materi dan tugas kelas akan muncul di sini."
          />
        )}
      </div>

      {/* Forum memanjang ke bawah seiring waktu, jadi diletakkan paling bawah. */}
      <div className="min-w-0 xl:col-span-2 xl:row-start-4 [&>*]:h-full">
        <ForumFeedCard posts={feed} scrollable />
      </div>

      <aside className="flex min-w-0 flex-col gap-4 xl:col-start-3 xl:row-span-2 xl:row-start-3 [&>*:last-child]:flex-1">
        <UpcomingCard items={schedule} />
        <RecentGrades items={recentGrades(classes)} />
        <TodoCard initial={todos} />
      </aside>
    </div>
  );
}
