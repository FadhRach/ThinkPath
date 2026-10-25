import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { SectionCard } from "@/components/shared/SectionCard";
import { Alert } from "@/components/ui/alert";
import { RequestCekPahamPanel } from "@/features/cekpaham/components/RequestCekPahamPanel";
import { AnalysisDetails } from "@/features/submissions/components/AnalysisDetails";
import { AnalysisPoller } from "@/features/submissions/components/AnalysisPoller";
import { AnswerCard } from "@/features/submissions/components/AnswerCard";
import { InstructionCard } from "@/features/submissions/components/InstructionCard";
import { EvidenceStrip } from "@/features/submissions/components/EvidenceStrip";
import { ReviewHeader } from "@/features/submissions/components/ReviewHeader";
import { ReviewSidebar } from "@/features/submissions/components/ReviewSidebar";
import { SimilarSubmissionsCard } from "@/features/submissions/components/SimilarSubmissionsCard";
import { buildEvidenceRows } from "@/features/submissions/lib/evidence";
import { ApiError } from "@/lib/api/errors";
import { getSubmissionCekPaham, getSubmissionDetail } from "@/lib/data";
import type { SubmissionDetail } from "@/lib/types";

/**
 * Pemeriksaan satu jawaban. Kolom kiri adalah bahan: siapa, dokumen atau tulisannya, ringkasan
 * bukti, dan rincian yang dilipat. Kolom kanan adalah keputusan dosen: nilai dan umpan balik,
 * saran, lalu Cek Paham dan pembanding bila bukti belum cukup.
 */
export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let detail: SubmissionDetail;
  try {
    detail = await getSubmissionDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // Halaman ini tetap harus terbuka bila fitur Cek Paham sedang bermasalah.
  const cekpahamItems = await getSubmissionCekPaham(detail.id).catch(() => []);
  const analysing = detail.analysis_state === "pending" || detail.analysis_state === "running";

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: "Periksa", href: "/dashboard/pengumpulan" },
          {
            label: detail.assignment.title,
            href: `/dashboard/pengumpulan?tugas=${detail.assignment.id}`,
          },
          { label: detail.student.display_name },
        ]}
      />

      {analysing ? (
        <>
          <AnalysisPoller />
          <Alert variant="info" title="Analisis sedang berjalan">
            Jawaban sudah tersimpan. Pembacaan teks, indikasi AI, dan level Bloom muncul dalam
            beberapa detik, tanpa perlu memuat ulang. Saran AI bisa diminta setelah itu.
          </Alert>
        </>
      ) : null}
      {detail.analysis_state === "failed" ? (
        <Alert variant="warning" title="Analisis gagal">
          Jawaban tersimpan, tetapi analisisnya tidak selesai. Tekan Analisis Ulang di bagian
          rincian analisis.
        </Alert>
      ) : null}

      <ReviewHeader detail={detail} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-5">
          <InstructionCard assignment={detail.assignment} />
          <AnswerCard detail={detail} />
          <SectionCard eyebrow="Ringkasan Bukti">
            <EvidenceStrip rows={buildEvidenceRows(detail)} />
          </SectionCard>
          <AnalysisDetails detail={detail} analysing={analysing} />
        </div>

        <aside className="min-w-0 xl:sticky xl:top-24">
          <ReviewSidebar
            submissionId={detail.id}
            grade={detail.grade}
            feedback={detail.teacher_feedback}
            analysisReady={detail.analysis_state === "done" && detail.analysis !== null}
          >
            <RequestCekPahamPanel submissionId={detail.id} items={cekpahamItems} />
            <SimilarSubmissionsCard submissionId={detail.id} items={detail.similar_submissions} />
          </ReviewSidebar>
        </aside>
      </div>
    </div>
  );
}
