import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TeacherAssignmentList } from "@/features/assignments/components/TeacherAssignmentList";
import { getAllAssignments } from "@/lib/data";

export default async function TeacherAssignmentsPage() {
  const assignments = await getAllAssignments();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Tugas</h1>
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/dashboard/tugas/new">
            <Plus /> Buat tugas
          </Link>
        </Button>
      </div>
      <TeacherAssignmentList assignments={assignments} />
    </div>
  );
}
