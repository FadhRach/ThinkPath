import { EmptyState } from "@/components/shared/EmptyState";
import { ReviewBoard } from "@/features/submissions/components/ReviewBoard";
import { getAllAssignments, getClasses, getTeacherSubmissions } from "@/lib/data";

export default async function SubmissionQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ kelas?: string; tugas?: string }>;
}) {
  const [submissions, assignments, classes, query] = await Promise.all([
    getTeacherSubmissions(),
    getAllAssignments(),
    getClasses(),
    searchParams,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Periksa pengumpulan</h1>
      {submissions.length ? (
        <ReviewBoard
          submissions={submissions}
          assignments={assignments}
          classes={classes.map(({ id, name }) => ({ id, name }))}
          initialClassId={query.kelas}
          initialAssignmentId={query.tugas}
        />
      ) : (
        <EmptyState
          title="Belum ada pengumpulan"
          caption="Pengumpulan mahasiswa akan muncul di sini begitu mereka mengirim jawaban."
        />
      )}
    </div>
  );
}
