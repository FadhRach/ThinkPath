import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { teacherLabel } from "@/features/classes/components/ArchivedClassNotice";
import { academicLabel } from "@/features/classes/lib/academic";
import { isOpenAssignment } from "@/features/classes/lib/student-class";
import { formatDate } from "@/lib/formatting";
import type { StudentClassWithAssignments } from "@/lib/types";

const VISIBLE_OPEN = 3;
const VISIBLE_WHEN_DONE = 2;

function deadlineNote(assignment: StudentClassWithAssignments["assignments"][number]) {
  const unfinished = isOpenAssignment(assignment);
  const overdue =
    unfinished && assignment.deadline && new Date(assignment.deadline).getTime() < Date.now();
  if (unfinished) {
    const text = assignment.deadline
      ? `${overdue ? "Lewat tenggat" : "Tenggat"} ${formatDate(assignment.deadline)}`
      : "Tanpa tenggat";
    return { text, overdue: Boolean(overdue) };
  }
  return {
    text:
      assignment.submission?.status === "reviewed" ? "Sudah dinilai" : "Menunggu penilaian dosen",
    overdue: false,
  };
}

/** Kartu satu kelas di beranda mahasiswa: identitas kelas dan beberapa tugas terdekatnya. */
export function StudentClassOverviewCard({
  classroom,
}: {
  classroom: StudentClassWithAssignments;
}) {
  const active = classroom.assignments
    .filter(isOpenAssignment)
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  const visible = active.length
    ? active.slice(0, VISIBLE_OPEN)
    : classroom.assignments.slice(0, VISIBLE_WHEN_DONE);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:px-6">
        <div className="min-w-0">
          <h3 className="text-heading font-semibold">
            <Link
              href={`/student/kelas/${classroom.id}`}
              className="underline-offset-4 hover:underline"
            >
              {classroom.name}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {teacherLabel(classroom.teacher_name)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{academicLabel(classroom)}</p>
        </div>
        <Button asChild variant="link" size="sm" className="shrink-0">
          <Link href={`/student/kelas/${classroom.id}?tab=materi`}>
            Materi kelas <ArrowRight />
          </Link>
        </Button>
      </div>

      <div className="divide-y divide-border">
        {visible.length ? (
          visible.map((assignment) => {
            const unfinished = isOpenAssignment(assignment);
            const note = deadlineNote(assignment);
            return (
              <div
                key={assignment.id}
                className="flex flex-col justify-between gap-3 px-5 py-5 sm:flex-row sm:items-center sm:gap-5 sm:px-6"
              >
                <div className="min-w-0">
                  <Link
                    href={`/student/submit/${assignment.id}`}
                    className="font-medium leading-relaxed underline-offset-4 hover:underline"
                  >
                    {assignment.title}
                  </Link>
                  <p
                    className={`mt-1.5 text-xs ${note.overdue ? "text-danger" : "text-muted-foreground"}`}
                  >
                    {note.text}
                  </p>
                </div>
                <Button
                  asChild
                  variant={unfinished ? "default" : "link"}
                  size={unfinished ? "default" : "sm"}
                >
                  <Link href={`/student/submit/${assignment.id}`}>
                    {unfinished
                      ? assignment.submission
                        ? "Lanjutkan"
                        : "Kerjakan"
                      : "Lihat jawaban"}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            );
          })
        ) : (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            Dosen belum membagikan tugas di kelas ini.
          </p>
        )}
      </div>

      {active.length > VISIBLE_OPEN ? (
        <Link
          href={`/student/kelas/${classroom.id}?tab=tugas`}
          className="block border-t border-border px-6 py-3 text-sm font-medium text-brand-ink hover:underline"
        >
          Lihat {active.length - VISIBLE_OPEN} tugas lainnya →
        </Link>
      ) : null}
    </Card>
  );
}
