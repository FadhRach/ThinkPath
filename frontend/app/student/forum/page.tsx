import { EmptyState } from "@/components/shared/EmptyState";
import { StudentForumBrowser } from "@/features/forum/components/StudentForumBrowser";
import { getClassForum, getStudentClasses } from "@/lib/data";

export default async function StudentForumPage() {
  const classes = await getStudentClasses();
  // Forum satu kelas yang gagal dimuat tidak boleh mengosongkan seluruh halaman.
  const perClass = await Promise.all(
    classes.map((studentClass) => getClassForum(studentClass.id).catch(() => [])),
  );
  const posts = perClass
    .flat()
    .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Forum</h1>
      {classes.length ? (
        <StudentForumBrowser
          classes={classes.map(({ id, name }) => ({ id, name }))}
          posts={posts}
        />
      ) : (
        <EmptyState
          title="Belum ada kelas"
          caption="Forum tersedia setelah kamu bergabung ke kelas dengan kode dari dosen."
        />
      )}
    </div>
  );
}
