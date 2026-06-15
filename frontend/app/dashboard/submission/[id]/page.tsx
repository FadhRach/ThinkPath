import Link from "next/link";
import { notFound } from "next/navigation";

import { EvidenceNotVerdictBanner } from "@/components/submission/EvidenceNotVerdictBanner";
import { EvidenceStrip } from "@/components/submission/EvidenceStrip";
import { ReasoningSummary } from "@/components/submission/ReasoningSummary";
import { RecommendationBlock } from "@/components/submission/RecommendationBlock";
import { SignalList } from "@/components/submission/SignalList";
import { ApiError } from "@/lib/api";
import { getSubmissionDetail } from "@/lib/data";
import { bandsForDetail } from "@/lib/evidence";
import { formatClockHHMM, formatDurationSeconds } from "@/lib/formatting";

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
    {
      label: "Proses",
      band: bands.processBand,
      detail: buildProcessSentence(detail),
    },
    {
      label: "Teks",
      band: bands.textBand,
      detail: buildTextSentence(detail),
    },
    {
      label: "Kognitif",
      band: bands.cognitiveBand,
      detail: buildCognitiveSentence(detail),
    },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      <Link href="/dashboard" className="text-body-sm text-ink-muted hover:text-ink">
        ← Kembali ke dashboard
      </Link>
      <header>
        <p className="caption-eyebrow">
          {detail.assignment.education_level} · Bloom L{detail.assignment.expected_bloom_level}
        </p>
        <h1 className="font-display text-display-1 mt-1">
          {detail.assignment.title}
        </h1>
        <p className="text-body text-ink-muted mt-2">
          Pengumpulan oleh {detail.student.display_name}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <article className="bg-paper-elevated border border-border rounded-card p-6">
          <p className="caption-eyebrow mb-3">Jawaban siswa</p>
          <p className="text-body-lg text-ink whitespace-pre-wrap">
            {detail.text_answer || "Belum ada teks jawaban."}
          </p>
        </article>

        <aside className="space-y-4">
          <EvidenceNotVerdictBanner />
          <section className="bg-paper-elevated border border-border rounded-card p-5 space-y-4">
            <p className="caption-eyebrow">Evidence strip</p>
            <EvidenceStrip rows={evidenceRows} />
          </section>
          <section className="bg-paper-elevated border border-border rounded-card p-5 space-y-3">
            <p className="caption-eyebrow">Ringkasan proses</p>
            <ReasoningSummary detail={detail} />
          </section>
          <section className="bg-paper-elevated border border-border rounded-card p-5 space-y-3">
            <p className="caption-eyebrow">Sinyal teks (placeholder)</p>
            <SignalList signals={detail.analysis?.signals ?? null} />
          </section>
          <RecommendationBlock
            recommendation={detail.analysis?.recommendation ?? null}
            expectedBloomLevel={detail.assignment.expected_bloom_level}
            observedBloomLevel={detail.analysis?.bloom_level ?? null}
          />
        </aside>
      </div>
    </div>
  );
}

function buildProcessSentence(detail: { reasoning_events: Array<{ event_type: string; payload: Record<string, unknown> }>; revision_count: number; duration_seconds: number | null; started_at: string; submitted_at: string | null }) {
  const paste = detail.reasoning_events.find((event) => event.event_type === "paste");
  const pasteCount = paste && typeof paste.payload?.char_count === "number" ? paste.payload.char_count : null;
  const pastePart = pasteCount !== null ? `1 paste ${pasteCount} karakter` : "tanpa paste besar";
  const submitClock = detail.submitted_at ? formatClockHHMM(detail.submitted_at) : "-";
  const startClock = formatClockHHMM(detail.started_at);
  return `Mulai ${startClock}, ${detail.revision_count} revisi, ${pastePart}, submit ${submitClock} (durasi ${formatDurationSeconds(detail.duration_seconds)}).`;
}

function buildTextSentence(detail: { assignment: { education_level: string }; analysis: { ai_band: "low" | "mid" | "high"; signals: Record<string, number> } | null }) {
  if (!detail.analysis) return "Sinyal teks belum tersedia (model belum aktif di tahap 1).";
  const perplexity = detail.analysis.signals?.perplexity;
  const base = BAND_DETAIL_COPY[detail.analysis.ai_band];
  if (typeof perplexity === "number") {
    return `Perplexity ${perplexity}. ${base} (relatif terhadap jenjang ${detail.assignment.education_level})`;
  }
  return base;
}

function buildCognitiveSentence(detail: { assignment: { expected_bloom_level: number }; analysis: { bloom_level: number } | null }) {
  if (!detail.analysis) return "Estimasi level kognitif belum tersedia (model belum aktif di tahap 1).";
  const gap = detail.assignment.expected_bloom_level - detail.analysis.bloom_level;
  if (gap <= 0) return `Level ${detail.analysis.bloom_level} - memenuhi target tugas (level ${detail.assignment.expected_bloom_level}).`;
  if (gap === 1) return `Level ${detail.analysis.bloom_level} - sedikit di bawah target (level ${detail.assignment.expected_bloom_level}).`;
  return `Level ${detail.analysis.bloom_level} - di bawah target tugas (level ${detail.assignment.expected_bloom_level}).`;
}
