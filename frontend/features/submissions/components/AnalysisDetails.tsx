import { AiScoreRing } from "@/features/submissions/components/AiScoreRing";
import { SectionCard } from "@/components/shared/SectionCard";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { BloomStepper } from "@/features/bloom/components/BloomStepper";
import { bloomCode, bloomLabel } from "@/features/bloom/lib/bloom";
import { AnalysisHistory } from "@/features/submissions/components/AnalysisHistory";
import {
  AnalysisSourceBadge,
  AnalysisSourceNote,
} from "@/features/submissions/components/AnalysisSourceBadge";
import { ConfidenceBadge } from "@/features/submissions/components/ConfidenceBadge";
import { ProcessTimeline } from "@/features/submissions/components/ProcessTimeline";
import { ReanalyzeButton } from "@/features/submissions/components/ReanalyzeButton";
import { RecommendationBlock } from "@/features/submissions/components/RecommendationBlock";
import { SignalBreakdown } from "@/features/submissions/components/SignalBreakdown";
import { SignalList, uniqueSignals } from "@/features/submissions/components/SignalList";
import { aiBandLabel } from "@/features/submissions/lib/status";
import type { SubmissionDetail } from "@/lib/types";

/** Bagian lipat: rincian skor AI, level Bloom, linimasa, dan riwayat analisis. */
export function AnalysisDetails({
  detail,
  analysing,
}: {
  detail: SubmissionDetail;
  analysing: boolean;
}) {
  const analysis = detail.analysis;
  const isFlagged = analysis?.ai_band === "high";
  const breakdown = analysis?.signal_breakdown ?? [];
  const extraSignals = uniqueSignals(
    analysis?.signals ?? null,
    breakdown.map((item) => item.evidence),
  );

  return (
    <details className="group rounded-2xl border border-border bg-card p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-bold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Rincian analisis dan bukti pengerjaan{" "}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          Bloom, asal skor, linimasa, dan riwayat
        </span>
      </summary>
      <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {analysis?.summary ? (
            <Alert variant={isFlagged ? "danger" : "info"} title="Ringkasan Analisis">
              {analysis.summary}
            </Alert>
          ) : null}

          <RecommendationBlock recommendation={analysis?.recommendation ?? null} />

          {analysis ? (
            <Card variant="raised" className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="caption-eyebrow text-brand-ink">
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
                Level teramati diukur dari isi jawaban dan tidak dipengaruhi oleh target tugas
                maupun skor AI.
              </p>
            </Card>
          ) : null}

          {breakdown.length > 0 ? (
            <SectionCard eyebrow="Asal Skor AI">
              <SignalBreakdown breakdown={breakdown} source={analysis?.analysis_source} />
            </SectionCard>
          ) : null}
        </div>

        <aside className="space-y-4">
          {analysis ? (
            <Card variant="raised" className="flex flex-col items-center gap-3 p-5 text-center">
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

          <SectionCard eyebrow="Riwayat Analisis">
            <AnalysisHistory runs={detail.analysis_history} />
          </SectionCard>

          <ReanalyzeButton submissionId={detail.id} busy={analysing} />
        </aside>
      </div>
    </details>
  );
}
