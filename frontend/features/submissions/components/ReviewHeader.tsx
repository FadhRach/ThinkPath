import { FileUp, History } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { bloomCode } from "@/features/bloom/lib/bloom";
import { academicLabel } from "@/features/classes/lib/academic";
import { AiScoreRing } from "@/features/submissions/components/AiScoreRing";
import { StatusBadge } from "@/features/submissions/components/StatusBadge";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import { countWords } from "@/lib/text";
import type { AiBand, SubmissionDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const BAND_WORD: Record<AiBand, string> = { low: "Rendah", mid: "Sedang", high: "Tinggi" };
const BAND_TEXT: Record<AiBand, string> = {
  low: "text-success",
  mid: "text-warning",
  high: "text-danger",
};

/** Ubin angka kunci kepala halaman. Tingginya seragam supaya ketiganya sejajar. */
function Metric({ tone = "muted", children }: { tone?: "muted" | "success"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-16 min-w-0 flex-1 items-center gap-3 rounded-xl px-4 sm:flex-none",
        tone === "success" ? "bg-success-soft" : "bg-muted",
      )}
    >
      {children}
    </div>
  );
}

function MetricText({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-bold text-foreground">{children}</div>
    </div>
  );
}

/**
 * Kepala pemeriksaan, sepadat mungkin: baris pertama tugas, mahasiswa, dan status periksa;
 * baris kedua info kelas dan waktu kumpul; di kanan tiga ubin angka (level, indikasi AI, nilai).
 */
export function ReviewHeader({ detail }: { detail: SubmissionDetail }) {
  const analysis = detail.analysis;
  const target = detail.assignment.expected_bloom_level;
  const below = analysis ? analysis.bloom_level < target : false;
  const classHref = detail.assignment.class_id
    ? `/dashboard/classes/${detail.assignment.class_id}`
    : null;

  return (
    <Card className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h1 className="min-w-0 break-words text-heading font-bold text-foreground">
              {detail.assignment.title}
            </h1>
            <span className="hidden text-muted-foreground sm:inline" aria-hidden="true">
              ·
            </span>
            <Link
              href={`/dashboard/students/${detail.student.id}`}
              className="font-semibold text-brand-ink hover:underline"
            >
              {detail.student.display_name}
            </Link>
            <StatusBadge status={detail.status} />
            {detail.is_imported ? (
              <Badge tone="neutral" title="Jawaban berasal dari dokumen unggahan">
                <FileUp className="h-3 w-3" aria-hidden="true" /> Dokumen
              </Badge>
            ) : null}
            {detail.revision_count > 0 ? (
              <Badge tone="info">
                <History className="h-3 w-3" aria-hidden="true" /> Revisi {detail.revision_count}×
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {classHref ? (
              <Link href={classHref} className="hover:text-brand-ink hover:underline">
                {academicLabel(detail.assignment)}
              </Link>
            ) : (
              academicLabel(detail.assignment)
            )}
            {" · "}Dikumpulkan {formatRelativeTime(detail.submitted_at)} (
            {formatDate(detail.submitted_at)}) · {countWords(detail.text_answer)} kata
          </p>
        </div>

        <div className="flex shrink-0 items-stretch gap-2.5">
          <Metric>
            <MetricText label="Level / target">
              <span className={cn("text-lg", below && "text-warning")}>
                {analysis ? `L${analysis.bloom_level}` : "–"}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {" "}
                / {bloomCode(target)}
              </span>
            </MetricText>
          </Metric>
          <Metric>
            {analysis ? (
              <>
                <AiScoreRing score={analysis.ai_score} band={analysis.ai_band} size={44} compact />
                <MetricText label="Indikasi AI">
                  <span className={BAND_TEXT[analysis.ai_band]}>{BAND_WORD[analysis.ai_band]}</span>
                </MetricText>
              </>
            ) : (
              <MetricText label="Indikasi AI">
                <span className="text-muted-foreground">Belum ada</span>
              </MetricText>
            )}
          </Metric>
          {detail.grade !== null ? (
            <Metric tone="success">
              <MetricText label="Nilai">
                <span className="text-lg">{detail.grade}</span>
              </MetricText>
            </Metric>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
