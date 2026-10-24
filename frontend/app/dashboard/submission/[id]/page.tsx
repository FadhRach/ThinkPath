import { notFound } from "next/navigation";

import { BackLink } from "@/components/shared/BackLink";
import { SectionCard } from "@/components/shared/SectionCard";
import { Alert } from "@/components/ui/alert";
import { RequestCekPahamPanel } from "@/features/cekpaham/components/RequestCekPahamPanel";
import { AnalysisDetails } from "@/features/submissions/components/AnalysisDetails";
import { AnalysisPoller } from "@/features/submissions/components/AnalysisPoller";
import { EvidenceStrip } from "@/features/submissions/components/EvidenceStrip";
import { GradingForm } from "@/features/submissions/components/GradingForm";
import { SentenceRhythm } from "@/features/submissions/components/SentenceRhythm";
import { SubmissionHeader } from "@/features/submissions/components/SubmissionHeader";
import { buildEvidenceRows } from "@/features/submissions/lib/evidence";
import { ApiError } from "@/lib/api/errors";
import { getSubmissionCekPaham, getSubmissionDetail } from "@/lib/data";
import type { SubmissionDetail } from "@/lib/types";

/**
 * Detail satu submission.
 *
 * Setiap fakta ditulis SEKALI: jawaban dan penilaian tampil lebih dahulu, bukti
 * terperinci dapat dibuka sesuai kebutuhan tanpa menghalangi alur membaca dan
 * memberi umpan balik.
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
  const backHref = detail.assignment.class_id
    ? `/dashboard/classes/${detail.assignment.class_id}?tab=tugas&assignment=${detail.assignment.id}`
    : "/dashboard/tugas";

  return (
    <div className="space-y-6">
      <BackLink
        href={backHref}
        label={detail.assignment.class_id ? "Kembali ke kelas" : "Kembali ke daftar tugas"}
      />

      {analysing ? (
        <>
          <AnalysisPoller />
          <Alert variant="info" title="Analisis sedang berjalan">
            Jawaban sudah tersimpan. Skor dan level Bloom muncul di halaman ini dalam beberapa
            detik, tanpa perlu dimuat ulang.
          </Alert>
        </>
      ) : null}
      {detail.analysis_state === "failed" ? (
        <Alert variant="warning" title="Analisis gagal">
          Jawaban tersimpan, tetapi analisisnya tidak selesai. Tekan Analisis Ulang di bagian bukti.
        </Alert>
      ) : null}

      <SubmissionHeader detail={detail} />

      {/* Bukti inti di atas esai: dosen melihat gambaran proses, teks, dan kognitif
          sebelum membaca jawaban. Rincian lengkap ada di bagian lipat bawah. */}
      <SectionCard eyebrow="Ringkasan Bukti">
        <EvidenceStrip rows={buildEvidenceRows(detail)} />
      </SectionCard>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(19rem,1fr)]">
        <SectionCard eyebrow="Jawaban mahasiswa">
          {detail.text_answer ? (
            <SentenceRhythm text={detail.text_answer} />
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada teks jawaban.</p>
          )}
        </SectionCard>
        <aside className="lg:sticky lg:top-24">
          <GradingForm
            key={detail.id}
            submissionId={detail.id}
            initialGrade={detail.grade}
            initialFeedback={detail.teacher_feedback}
          />
        </aside>
      </div>

      <RequestCekPahamPanel submissionId={detail.id} items={cekpahamItems} />
      <AnalysisDetails detail={detail} analysing={analysing} />
    </div>
  );
}
