import { notFound } from "next/navigation";

import { AiScoreRing } from "@/components/common/AiScoreRing";
import { BackLink } from "@/components/common/BackLink";
import { AvatarInitials } from "@/components/common/AvatarInitials";
import { BloomStepper } from "@/components/common/BloomStepper";
import { Callout } from "@/components/common/Callout";
import { SectionCard } from "@/components/common/SectionCard";
import {
  AnalysisSourceBadge,
  AnalysisSourceNote,
} from "@/components/submission/AnalysisSourceBadge";
import { ConfidenceBadge } from "@/components/submission/ConfidenceBadge";
import { EvidenceStrip } from "@/components/submission/EvidenceStrip";
import { GradingForm } from "@/components/submission/GradingForm";
import { ProcessTimeline } from "@/components/submission/ProcessTimeline";
import { ReanalyzeButton } from "@/components/submission/ReanalyzeButton";
import { RecommendationBlock } from "@/components/submission/RecommendationBlock";
import { SentenceRhythm } from "@/components/submission/SentenceRhythm";
import { SignalBreakdown } from "@/components/submission/SignalBreakdown";
import { SignalList, uniqueSignals } from "@/components/submission/SignalList";
import { VerificationPanel } from "@/components/submission/VerificationPanel";
import { Card } from "@/components/ui/card";
import { academicLabel } from "@/lib/academic";
import { ApiError } from "@/lib/api";
import { bloomCode, bloomLabel } from "@/lib/bloom";
import { getSubmissionDetail } from "@/lib/data";
import { bandsForDetail } from "@/lib/evidence";
import { formatDurationSeconds } from "@/lib/formatting";
import type { SubmissionDetail } from "@/lib/types";
import { aiBandBadgeClass, aiBandLabel, submissionStatusMeta } from "@/lib/ui";
import { cn } from "@/lib/utils";

const BAND_DETAIL_COPY: Record<"low" | "mid" | "high", string> = {
  low: "Tidak ada pola gaya yang menonjol.",
  mid: "Beberapa sinyal layak diperhatikan.",
  high: "Beberapa sinyal kuat perlu ditinjau.",
};

/**
 * Detail satu submission.
 *
 * Setiap fakta ditulis SEKALI. Versi sebelumnya mengulang jam mulai, revisi,
 * dan tempel di lima tempat (header, Evidence Strip, penanda linimasa, daftar
 * linimasa, Ringkasan Proses), sehingga halaman memanjang tanpa menambah bukti.
 * Kolom kiri untuk membaca dan memutuskan; kolom kanan untuk bukti.
 */
export default async function SubmissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let detail: SubmissionDetail;
  try {
    detail = await getSubmissionDetail(params.id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const bands = bandsForDetail(detail);
  const evidenceRows = [
    { label: "Proses", band: bands.processBand, detail: buildProcessSentence(detail) },
    { label: "Teks", band: bands.textBand, detail: buildTextSentence(detail) },
    { label: "Kognitif", band: bands.cognitiveBand, detail: buildCognitiveSentence(detail) },
  ];
  const analysis = detail.analysis;
  const isFlagged = analysis?.ai_band === "high";
  const status = submissionStatusMeta(detail.status);
  const breakdown = analysis?.signal_breakdown ?? [];
  const extraSignals = uniqueSignals(
    analysis?.signals ?? null,
    breakdown.map((item) => item.evidence),
  );
  const backHref = detail.assignment.class_id
    ? `/dashboard/classes/${detail.assignment.class_id}?assignment=${detail.assignment.id}`
    : "/dashboard/tugas";

  return (
    <div className="space-y-6">
      <BackLink
        href={backHref}
        label={detail.assignment.class_id ? "Kembali ke kelas" : "Kembali ke daftar tugas"}
      />

      <Card className="flex flex-col gap-4 p-5 shadow-soft sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <AvatarInitials name={detail.student.display_name} size="lg" />
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-display-2">
              {detail.student.display_name}
            </h1>
            <p className="text-body font-medium text-foreground">{detail.assignment.title}</p>
            <p className="text-body-sm text-muted-foreground">
              {academicLabel(detail.assignment)} &middot; Target{" "}
              {bloomCode(detail.assignment.expected_bloom_level)} &middot;{" "}
              {countWords(detail.text_answer)} kata
              {detail.grade !== null ? ` · Nilai ${detail.grade}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Di layar lebar cincin skor terlihat di samping. Di ponsel kolom
              bukti turun ke bawah formulir, jadi ringkasannya dinaikkan ke sini. */}
          {analysis ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-body-sm font-semibold lg:hidden",
                aiBandBadgeClass(analysis.ai_band),
              )}
            >
              {aiBandLabel(analysis.ai_band)} &middot; {analysis.ai_score}
            </span>
          ) : null}
          {isFlagged ? (
            <span className="hidden items-center rounded-full bg-danger-soft px-3 py-1 text-body-sm font-semibold text-danger lg:inline-flex">
              {aiBandLabel("high")}
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-body-sm font-semibold",
              status.badgeClass,
            )}
          >
            {status.label}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          {analysis?.summary ? (
            <Callout variant={isFlagged ? "danger" : "info"} title="Ringkasan Analisis">
              {analysis.summary}
            </Callout>
          ) : null}

          <RecommendationBlock recommendation={analysis?.recommendation ?? null} />

          {analysis ? (
            <Card className="space-y-4 p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="caption-eyebrow text-primary">
                    Level Kognitif &middot; Taksonomi Bloom
                  </p>
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    Teramati {bloomCode(analysis.bloom_level)} {bloomLabel(analysis.bloom_level)},
                    target {bloomCode(detail.assignment.expected_bloom_level)}{" "}
                    {bloomLabel(detail.assignment.expected_bloom_level)}
                  </p>
                </div>
                <ConfidenceBadge confidence={analysis.bloom_confidence} />
              </div>
              <BloomStepper
                observedLevel={analysis.bloom_level}
                targetLevel={detail.assignment.expected_bloom_level}
              />
              <p className="text-caption text-muted-foreground">
                Level teramati diukur dari isi jawaban dan tidak dipengaruhi oleh target
                tugas maupun skor AI.
              </p>
            </Card>
          ) : null}

          <SectionCard eyebrow="Jawaban Mahasiswa">
            {detail.text_answer ? (
              <SentenceRhythm text={detail.text_answer} />
            ) : (
              <p className="text-body text-muted-foreground">Belum ada teks jawaban.</p>
            )}
          </SectionCard>

          <VerificationPanel submissionId={detail.id} verification={detail.verification} />

          <GradingForm
            submissionId={detail.id}
            initialGrade={detail.grade}
            initialFeedback={detail.teacher_feedback}
          />
        </div>

        <aside className="space-y-4">
          {analysis ? (
            <Card className="flex flex-col items-center gap-3 p-5 text-center shadow-soft">
              <AiScoreRing score={analysis.ai_score} band={analysis.ai_band} />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-body-sm font-semibold text-foreground">
                  {aiBandLabel(analysis.ai_band)}
                </span>
                <ConfidenceBadge confidence={analysis.confidence} />
                <AnalysisSourceBadge source={analysis.analysis_source} />
              </div>
              <AnalysisSourceNote source={analysis.analysis_source} />
              <p className="text-caption text-muted-foreground">
                Bukti untuk ditinjau bersama konteks Anda, bukan vonis.
              </p>
            </Card>
          ) : null}

          <SectionCard eyebrow="Ringkasan Bukti">
            <EvidenceStrip rows={evidenceRows} />
          </SectionCard>

          {breakdown.length > 0 ? (
            <SectionCard eyebrow="Asal Skor AI">
              <SignalBreakdown breakdown={breakdown} source={analysis?.analysis_source} />
            </SectionCard>
          ) : null}

          {/* Tanpa rincian skor, daftar sinyal adalah satu-satunya penjelasan
              teks dan selalu ditampilkan. Dengan rincian, hanya temuan yang
              belum muncul di sana yang tersisa. */}
          {breakdown.length === 0 || extraSignals.length > 0 ? (
            <SectionCard eyebrow={breakdown.length > 0 ? "Temuan Lain di Teks" : "Sinyal Teks"}>
              <SignalList
                signals={analysis?.signals ?? null}
                exclude={breakdown.map((item) => item.evidence)}
              />
            </SectionCard>
          ) : null}

          <SectionCard eyebrow="Linimasa Pengerjaan">
            <ProcessTimeline
              events={detail.reasoning_events}
              startedAt={detail.started_at}
              submittedAt={detail.submitted_at}
            />
          </SectionCard>

          <ReanalyzeButton submissionId={detail.id} />
        </aside>
      </div>
    </div>
  );
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

function buildProcessSentence(detail: SubmissionDetail): string {
  // Revisi di sini berarti Simpan Revisi setelah dikumpulkan, bukan suntingan
  // saat menulis, jadi kalimatnya tidak boleh terbaca "tidak pernah menyunting".
  const revisionPart =
    detail.revision_count === 0
      ? "Dikumpulkan sekali"
      : `Direvisi ${detail.revision_count} kali setelah dikumpulkan`;
  const growth = detail.reasoning_events.some((event) => event.event_type === "progress")
    ? "kurva pertumbuhan kata terekam"
    : "kurva pertumbuhan kata tidak terekam";
  return `${revisionPart}, ${growth}, durasi ${formatDurationSeconds(detail.duration_seconds)}.`;
}

function buildTextSentence(detail: SubmissionDetail): string {
  if (!detail.analysis) return "Sinyal teks belum tersedia. Gunakan Analisis Ulang.";
  return `Skor ${detail.analysis.ai_score} dari 100. ${BAND_DETAIL_COPY[detail.analysis.ai_band]}`;
}

function buildCognitiveSentence(detail: SubmissionDetail): string {
  if (!detail.analysis) return "Estimasi level kognitif belum tersedia.";
  const observed = detail.analysis.bloom_level;
  const expected = detail.assignment.expected_bloom_level;
  const gap = expected - observed;
  const observedText = `${bloomCode(observed)} ${bloomLabel(observed)}`;
  if (gap <= 0) return `${observedText}, memenuhi target ${bloomCode(expected)}.`;
  if (gap === 1) return `${observedText}, satu tingkat di bawah target ${bloomCode(expected)}.`;
  return `${observedText}, ${gap} tingkat di bawah target ${bloomCode(expected)}.`;
}
