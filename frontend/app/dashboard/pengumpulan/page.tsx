import { ClipboardCheck, FileCheck2, Files } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { SubmissionTable } from "@/components/dashboard/SubmissionTable";
import { TeacherStat } from "@/components/dashboard/TeacherUi";
import { getTeacherSubmissions } from "@/lib/data";

export default async function SubmissionQueuePage() {
  const submissions = await getTeacherSubmissions();
  return <div className="space-y-5"><PageHeader title="Periksa pengumpulan" subtitle="Baca jawaban mahasiswa dan berikan nilai serta umpan balik." /><div className="grid gap-3 sm:grid-cols-3"><TeacherStat icon={ClipboardCheck} label="Menunggu pemeriksaan" value={submissions.filter((row) => row.status === "submitted").length} tone="coral" /><TeacherStat icon={FileCheck2} label="Sudah dinilai" value={submissions.filter((row) => row.status === "reviewed").length} /><TeacherStat icon={Files} label="Total pengumpulan" value={submissions.length} tone="indigo" /></div><SubmissionTable submissions={submissions} initialFilter="needs_review" /></div>;
}
