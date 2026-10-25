import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { ForumBrowser } from "@/features/forum/components/ForumBrowser";
import { getClasses, getForumsOf } from "@/lib/data";

export default async function TeacherForumPage() {
  const classes = await getClasses();
  const posts = await getForumsOf(classes.map((klass) => klass.id));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Forum</h1>
      {classes.length ? (
        <ForumBrowser
          viewer="teacher"
          classes={classes.map(({ id, name }) => ({ id, name }))}
          posts={posts}
        />
      ) : (
        <EmptyState
          title="Belum ada kelas"
          caption="Forum tersedia setelah Anda membuat kelas dan mahasiswa bergabung."
          action={
            <Button asChild>
              <Link href="/dashboard/classes/new">Buat kelas</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
