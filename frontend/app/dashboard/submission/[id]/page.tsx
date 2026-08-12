import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiScoreRing } from "@/components/common/AiScoreRing";
import { AvatarInitials } from "@/components/common/AvatarInitials";
import { BloomStepper } from "@/components/common/BloomStepper";
import { Callout } from "@/components/common/Callout";
import {
  AnalysisSourceBadge,
  AnalysisSourceNote,
} from "@/components/submission/AnalysisSourceBadge";
import { ConfidenceBadge } from "@/components/submission/ConfidenceBadge";
import { ProcessTimeline } from "@/components/submission/ProcessTimeline";
import { SignalBreakdown } from "@/components/submission/SignalBreakdown";
import { EvidenceNotVerdictBanner } from "@/components/submission/EvidenceNotVerdictBanner";
import { EvidenceStrip } from "@/components/submission/EvidenceStrip";
import { GradingForm } from "@/components/submission/GradingForm";
import { ReanalyzeButton } from "@/components/submission/ReanalyzeButton";
import { ReasoningSummary } from "@/components/submission/ReasoningSummary";
import { RecommendationBlock } from "@/components/submission/RecommendationBlock";
import { SignalList } from "@/components/submission/SignalList";
import { VerificationPanel } from "@/components/submission/VerificationPanel";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { bloomCode, bloomLabel } from "@/lib/bloom";
import { getSubmissionDetail } from "@/lib/data";
import { bandsForDetail } from "@/lib/evidence";
import { formatClockHHMM, formatDurationSeconds } from "@/lib/formatting";
import { aiBandLabel } from "@/lib/ui";
import { academicLabel } from "@/lib/academic";

const BAND_DETAIL_COPY: Record<"low" | "mid" | "high", string> = {
  low: "Pola wajar untuk jenjang ini.",
  mid: "Beberapa sinyal layak diperhatikan.",
  high: "Beberapa sinyal kuat perlu ditinjau.",
};

export default async function SubmissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let detail;
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

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke dashboard
      </Link>

      <Card className="flex flex-wrap items-center gap-4 p-5 shadow-soft">
        <AvatarInitials name={detail.student.display_name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-display-2 font-extrabold tracking-tight text-foreground">
            {detail.student.display_name} &middot; {detail.assignment.title}
          </h1>
          <p className="text-body-sm text-muted-foreground">
            {academicLabel(detail.assignment)} &middot; Target{" "}
            {bloomCode(detail.assignment.expected_bloom_level)} &middot; Mulai{" "}
            {formatClockHHMM(detail.started_at)}
            {detail.submitted_at
              ? ` · Dikumpulkan ${formatClockHHMM(detail.submitted_at)}`
              : ""}{" "}
            &middot; Durasi {formatDurationSeconds(detail.duration_seconds)} &middot;{" "}
            {countWords(detail.text_answer)} kata
            {detail.revision_count > 0 ? ` · ${detail.revision_count}x revisi` : ""}
            {detail.grade !== null ? ` · Nilai ${detail.grade}` : ""}
          </p>
        </div>
        {isFlagged ? (
          <span className="inline-flex items-center rounded-full bg-danger-soft px-3 py-1 text-body-sm font-semibold text-danger">
            Flagged
          </span>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <EvidenceNotVerdictBanner />

          {analysis ? (
            <Card className="space-y-4 p-5 shadow-soft">
              <div>
                <p className="caption-eyebrow text-primary">
                  Level Kognitif &middot; Taksonomi Bloom
                </p>
                <p className="mt-1 text-body-sm text-muted-foreground">
                  Teramati: {bloomCode(analysis.bloom_level)} {bloomLabel(analysis.bloom_level)}
                  {" · "}Target: {bloomCode(detail.assignment.expected_bloom_level)}{" "}
                  {bloomLabel(detail.assignment.expected_bloom_level)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ConfidenceBadge confidence={analysis.bloom_confidence} />
                </div>
              </div>
              <BloomStepper
                observedLevel={analysis.bloom_level}
                targetLevel={detail.assignment.expected_bloom_level}
              />
              <p className="text-body-sm text-muted-foreground">
                Level teramati diukur dari isi jawaban dan tidak dipengaruhi oleh target
                tugas maupun skor AI di samping.
              </p>
            </Card>
          ) : null}

          {analysis?.summary ? (
            <Callout variant={isFlagged ? "danger" : "info"} title="Ringkasan Analisis">
              {analysis.summary}
            </Callout>
          ) : null}

          <RecommendationBlock recommendation={analysis?.recommendation ?? null} />

          <VerificationPanel
            submissionId={detail.id}
            verification={detail.verification}
          />

          <Card className="space-y-3 p-5 shadow-soft">
            <p className="caption-eyebrow text-primary">Jawaban Mahasiswa</p>
            <p className="whitespace-pre-wrap text-body text-foreground">
              {detail.text_answer || "Belum ada teks jawaban."}
            </p>
          </Card>

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
            </Card>
          ) : null}

          <Card className="space-y-3 p-5 shadow-soft">
            <p className="caption-eyebrow text-primary">Sinyal Teks</p>
            <SignalList signals={analysis?.signals ?? null} />
          </Card>

          {analysis?.signal_breakdown?.length ? (
            <Card className="space-y-3 p-5 shadow-soft">
              <p className="caption-eyebrow text-primary">Asal Skor AI</p>
              <SignalBreakdown breakdown={analysis.signal_breakdown} />
            </Card>
          ) : null}

          <Card className="space-y-3 p-5 shadow-soft">
            <p className="caption-eyebrow text-primary">Evidence Strip</p>
            <EvidenceStrip rows={evidenceRows} />
          </Card>

          <Card className="space-y-3 p-5 shadow-soft">
            <p className="caption-eyebrow text-primary">Linimasa Pengerjaan</p>
            <ProcessTimeline
              events={detail.reasoning_events}
              startedAt={detail.started_at}
              submittedAt={detail.submitted_at}
            />
          </Card>

          <Card className="space-y-2 p-5 shadow-soft">
            <p className="caption-eyebrow text-primary">Ringkasan Proses</p>
            <ReasoningSummary detail={detail} />
          </Card>

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

function buildProcessSentence(detail: {
  reasoning_events: Array<{ event_type: string; payload: Record<string, unknown> }>;
  revision_count: number;
  duration_seconds: number | null;
  started_at: string;
  submitted_at: string | null;
}) {
  const paste = detail.reasoning_events.find((event) => event.event_type === "paste");
  const pasteCount =
    paste && typeof paste.payload?.char_count === "number" ? paste.payload.char_count : null;
  const pastePart = pasteCount !== null ? `1 paste ${pasteCount} karakter` : "tanpa paste besar";
  const submitClock = detail.submitted_at ? formatClockHHMM(detail.submitted_at) : "-";
  const startClock = formatClockHHMM(detail.started_at);
  return `Mulai ${startClock}, ${detail.revision_count} revisi, ${pastePart}, submit ${submitClock} (durasi ${formatDurationSeconds(detail.duration_seconds)}).`;
}

function buildTextSentence(detail: {
  assignment: { education_level: string };
  analysis: { ai_band: "low" | "mid" | "high"; ai_score: number } | null;
}) {
  if (!detail.analysis) return "Sinyal teks belum tersedia. Gunakan Analisis Ulang.";
  const base = BAND_DETAIL_COPY[detail.analysis.ai_band];
  return `Probabilitas AI ${detail.analysis.ai_score}%. ${base} (relatif terhadap jenjang ${detail.assignment.education_level})`;
}

function buildCognitiveSentence(detail: {
  assignment: { expected_bloom_level: number };
  analysis: { bloom_level: number } | null;
}) {
  if (!detail.analysis) return "Estimasi level kognitif belum tersedia.";
  const gap = detail.assignment.expected_bloom_level - detail.analysis.bloom_level;
  if (gap <= 0)
    return `Level ${detail.analysis.bloom_level} - memenuhi target tugas (level ${detail.assignment.expected_bloom_level}).`;
  if (gap === 1)
    return `Level ${detail.analysis.bloom_level} - sedikit di bawah target (level ${detail.assignment.expected_bloom_level}).`;
  return `Level ${detail.analysis.bloom_level} - di bawah target tugas (level ${detail.assignment.expected_bloom_level}).`;
}
