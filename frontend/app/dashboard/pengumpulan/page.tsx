import { ClipboardCheck, FileCheck2, Files } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SubmissionTable } from "@/features/submissions/components/SubmissionTable";
import { getTeacherSubmissions } from "@/lib/data";

export default async function SubmissionQueuePage() {
  const submissions = await getTeacherSubmissions();
  const waiting = submissions.filter((row) => row.status === "submitted").length;
  const graded = submissions.filter((row) => row.status === "reviewed").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Periksa pengumpulan"
        subtitle="Baca jawaban mahasiswa dan berikan nilai serta umpan balik."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={ClipboardCheck}
          label="Menunggu pemeriksaan"
          value={waiting}
          tone="danger"
        />
        <StatCard icon={FileCheck2} label="Sudah dinilai" value={graded} />
        <StatCard icon={Files} label="Total pengumpulan" value={submissions.length} />
      </div>
      <SubmissionTable submissions={submissions} initialFilter="needs_review" />
    </div>
  );
}
