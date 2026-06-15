import { AssignmentSelector } from "@/components/dashboard/AssignmentSelector";
import { AssignmentSummary } from "@/components/dashboard/AssignmentSummary";
import { ClassSelector } from "@/components/dashboard/ClassSelector";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SubmissionTable } from "@/components/dashboard/SubmissionTable";
import { getAssignments, getClasses, getSubmissions } from "@/lib/data";

interface SearchParams {
  class?: string;
  assignment?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const classes = await getClasses();

  if (classes.length === 0) {
    return (
      <DashboardShell>
        <EmptyState
          title="Belum ada kelas"
          caption="Buat kelas pertama untuk mulai memantau pola berpikir siswa. Setiap kelas memiliki kode gabung untuk siswa."
        />
      </DashboardShell>
    );
  }

  const selectedClass =
    classes.find((cls) => cls.id === searchParams.class) ?? classes[0];
  const assignments = await getAssignments(selectedClass.id);

  if (assignments.length === 0) {
    return (
      <DashboardShell>
        <ClassSelector classes={classes} selectedClassId={selectedClass.id} />
        <EmptyState
          title="Belum ada tugas di kelas ini"
          caption="Setelah kamu membuat tugas, hasil pengumpulan siswa akan muncul di sini lengkap dengan rangkuman bukti."
        />
      </DashboardShell>
    );
  }

  const selectedAssignment =
    assignments.find((assignment) => assignment.id === searchParams.assignment) ??
    assignments[0];
  const submissions = await getSubmissions(selectedAssignment.id);

  return (
    <DashboardShell>
      <ClassSelector classes={classes} selectedClassId={selectedClass.id} />
      <AssignmentSelector
        classId={selectedClass.id}
        assignments={assignments}
        selectedAssignmentId={selectedAssignment.id}
      />
      <AssignmentSummary assignment={selectedAssignment} />
      {submissions.length === 0 ? (
        <EmptyState
          title="Belum ada pengumpulan"
          caption="Siswa belum mengumpulkan tugas ini. Begitu mereka submit, tabel bukti akan terisi otomatis."
        />
      ) : (
        <SubmissionTable
          submissions={submissions}
          expectedBloomLevel={selectedAssignment.expected_bloom_level}
        />
      )}
    </DashboardShell>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <p className="caption-eyebrow">Dashboard guru</p>
        <h1 className="font-display text-display-1 mt-1">Ringkasan kelas</h1>
        <p className="text-body text-ink-muted mt-2 max-w-xl">
          Pilih kelas dan tugas untuk meninjau bukti integritas siswa. Skor di
          sini selalu disandingkan dengan sinyal proses dan kognitif.
        </p>
      </header>
      {children}
    </div>
  );
}
