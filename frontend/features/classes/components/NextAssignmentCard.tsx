import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isOpenAssignment } from "@/features/classes/lib/student-class";
import { formatRelativeTime } from "@/lib/formatting";
import type { StudentClassWithAssignments } from "@/lib/types";

/** Tugas berikutnya yang harus dikerjakan di kelas ini, atau keterangan bila tidak ada. */
export function NextAssignmentCard({
  assignments,
}: {
  assignments: StudentClassWithAssignments["assignments"];
}) {
  const next = assignments.find(isOpenAssignment);
  const submittedCount = assignments.filter(
    (assignment) => assignment.submission?.status === "submitted",
  ).length;

  return (
    <Card className="p-5 sm:p-6">
      {next ? (
        <>
          <h2 className="text-heading font-semibold">{next.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {next.deadline ? `Tenggat ${formatRelativeTime(next.deadline)}` : "Tugas dari dosen"}
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href={`/student/submit/${next.id}`}>
              Buka tugas <ArrowRight />
            </Link>
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-heading font-semibold">
            {submittedCount ? "Semua tugas sudah dikumpulkan" : "Belum ada tugas aktif"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {submittedCount
              ? "Nilai dan umpan balik akan muncul setelah dosen meninjau jawabanmu."
              : "Kamu bisa mulai dengan mempelajari materi kelas dari tab Materi."}
          </p>
        </>
      )}
    </Card>
  );
}
