import { ClipboardCheck, ClipboardList, CalendarClock, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { TeacherAssignmentList } from "@/components/dashboard/TeacherAssignmentList";
import { TeacherStat } from "@/components/dashboard/TeacherUi";
import { Button } from "@/components/ui/button";
import { getAllAssignments } from "@/lib/data";

export default async function TeacherAssignmentsPage() {
  const assignments = await getAllAssignments();
  const now = Date.now();
  return <div className="space-y-5"><PageHeader title="Kelola tugas" subtitle="Siapkan instruksi, atur tenggat, dan pantau pengumpulan di seluruh kelas." actions={<Button asChild className="rounded-xl"><Link href="/dashboard/tugas/new"><Plus className="mr-1.5 h-4 w-4" />Buat tugas</Link></Button>} /><div className="grid gap-3 sm:grid-cols-3"><TeacherStat icon={ClipboardList} label="Total tugas" value={assignments.length} tone="indigo" /><TeacherStat icon={CalendarClock} label="Tugas masih dibuka" value={assignments.filter((item) => !item.deadline || new Date(item.deadline).getTime() > now).length} /><TeacherStat icon={ClipboardCheck} label="Pengumpulan perlu diperiksa" value={assignments.reduce((sum, item) => sum + item.needs_review_count, 0)} tone="coral" /></div><TeacherAssignmentList assignments={assignments} /></div>;
}
