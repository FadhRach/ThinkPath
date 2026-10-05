import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TeacherClassDirectory } from "@/components/dashboard/TeacherClassDirectory";
import { Button } from "@/components/ui/button";
import { getAllAssignments, getClasses } from "@/lib/data";

export default async function ClassesPage() {
  const [classes, assignments] = await Promise.all([getClasses(), getAllAssignments()]);
  return <div className="space-y-5"><PageHeader title="Kelas yang Anda ajar" subtitle="Kelola mahasiswa, materi, pengumuman, dan tugas di setiap kelas." actions={<Button asChild className="rounded-xl"><Link href="/dashboard/classes/new"><Plus className="mr-1.5 h-4 w-4" />Buat kelas</Link></Button>} />{classes.length ? <TeacherClassDirectory classes={classes} assignments={assignments} /> : <EmptyState title="Belum ada kelas" caption="Buat kelas pertama, lalu bagikan kode gabung kepada mahasiswa." action={<Button asChild><Link href="/dashboard/classes/new">Buat kelas</Link></Button>} />}</div>;
}
