import { EmptyState } from "@/components/shared/EmptyState";
import { ForumBrowser } from "@/features/forum/components/ForumBrowser";
import { getForumsOf, getStudentClasses } from "@/lib/data";

export default async function StudentForumPage() {
  const classes = await getStudentClasses();
  const posts = await getForumsOf(classes.map((studentClass) => studentClass.id));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Forum</h1>
      {classes.length ? (
        <ForumBrowser
          viewer="student"
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
