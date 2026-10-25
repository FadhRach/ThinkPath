import { EmptyState } from "@/components/shared/EmptyState";
import { GradebookView } from "@/features/gradebook/components/GradebookView";
import { getOwnProgress, getStudentClasses } from "@/lib/data";

export default async function GradebookPage({
  searchParams,
}: {
  searchParams: Promise<{ kelas?: string }>;
}) {
  const [classes, progress, query] = await Promise.all([
    getStudentClasses(),
    getOwnProgress().catch(() => ({ classes: [] })),
    searchParams,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Gradebook</h1>
      {classes.length ? (
        <GradebookView
          key={query.kelas}
          classes={classes}
          series={progress.classes}
          initialClassId={query.kelas}
        />
      ) : (
        <EmptyState
          title="Belum ada kelas"
          caption="Gabung kelas dengan kode dari dosen di Beranda. Nilaimu akan terkumpul di sini."
        />
      )}
    </div>
  );
}
