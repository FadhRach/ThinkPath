import { CalendarClock, ClipboardCheck, ClipboardList, Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { TeacherAssignmentList } from "@/features/assignments/components/TeacherAssignmentList";
import { getAllAssignments } from "@/lib/data";

export default async function TeacherAssignmentsPage() {
  const assignments = await getAllAssignments();
  const now = Date.now();
  const open = assignments.filter(
    (item) => !item.deadline || new Date(item.deadline).getTime() > now,
  );
  const needsReview = assignments.reduce((sum, item) => sum + item.needs_review_count, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kelola tugas"
        subtitle="Siapkan instruksi, atur tenggat, dan pantau pengumpulan di seluruh kelas."
        actions={
          <Button asChild>
            <Link href="/dashboard/tugas/new">
              <Plus /> Buat tugas
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={ClipboardList} label="Total tugas" value={assignments.length} />
        <StatCard icon={CalendarClock} label="Tugas masih dibuka" value={open.length} />
        <StatCard
          icon={ClipboardCheck}
          label="Pengumpulan perlu diperiksa"
          value={needsReview}
          tone="danger"
        />
      </div>
      <TeacherAssignmentList assignments={assignments} />
    </div>
  );
}
