import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

import { BloomTrendChart } from "@/components/common/BloomTrendChart";
import { Card } from "@/components/ui/card";
import { bloomShortLabel } from "@/lib/bloom";
import { TREND_LABEL, TREND_TONE, gapToTarget, toChartPoints, trendNarrative } from "@/lib/cognitive";
import { formatDate } from "@/lib/formatting";
import type { CognitiveClassSeries, TrendDirection } from "@/lib/types";
import { aiBandBadgeClass, aiBandLabel } from "@/lib/ui";
import { cn } from "@/lib/utils";

const TREND_ICON: Record<TrendDirection, typeof TrendingUp> = {
  naik: TrendingUp,
  datar: Minus,
  turun: TrendingDown,
  belum_cukup_data: Minus,
};

interface Props {
  series: CognitiveClassSeries;
  /** Dosen melihat indikasi AI per tugas; mahasiswa tidak. Dugaan yang belum
   *  diverifikasi tidak pantas ditampilkan sebagai penilaian ke mahasiswa. */
  showBand?: boolean;
  /** Hanya dosen yang bisa membuka halaman detail submission. */
  linkSubmissions?: boolean;
}

export function CognitiveClassCard({ series, showBand = false, linkSubmissions = false }: Props) {
  const gap = gapToTarget(series);
  const TrendIcon = TREND_ICON[series.direction];
  const belowTarget = gap != null && gap <= -1;

  return (
    <Card className="space-y-4 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-foreground">{series.class_name}</h2>
          <p className="text-body-sm text-muted-foreground">{series.subject}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium",
            TREND_TONE[series.direction],
          )}
        >
          <TrendIcon className="h-3.5 w-3.5" />
          {TREND_LABEL[series.direction]}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Level saat ini"
          value={series.current_level != null ? `L${series.current_level}` : "-"}
          caption={
            series.current_level != null
              ? bloomShortLabel(Math.round(series.current_level))
              : "Belum ada tugas dianalisis"
          }
        />
        <Metric
          label="Target rata-rata"
          value={series.average_target != null ? `L${series.average_target}` : "-"}
          caption="Ditetapkan dosen per tugas"
        />
        <Metric
          label="Selisih"
          value={gap != null ? (gap > 0 ? `+${gap}` : `${gap}`) : "-"}
          caption={belowTarget ? "Di bawah tuntutan tugas" : "Sesuai atau di atas target"}
          tone={belowTarget ? "warning" : "default"}
        />
      </div>

      <div>
        <BloomTrendChart
          data={toChartPoints(series)}
          target={series.average_target}
          height={200}
        />
      </div>

      <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-body-sm text-muted-foreground">
        {trendNarrative(series)}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-body-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Tugas</th>
              <th className="py-2 pr-4 font-medium">Level</th>
              <th className="py-2 pr-4 font-medium">Target</th>
              <th className="py-2 pr-4 font-medium">Dikumpulkan</th>
              {showBand ? <th className="py-2 font-medium">Indikasi AI</th> : null}
            </tr>
          </thead>
          <tbody>
            {series.points.map((point, index) => (
              <tr key={point.submission_id} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-4">
                  <span className="mr-2 text-caption text-muted-foreground">T{index + 1}</span>
                  {linkSubmissions ? (
                    <Link
                      href={`/dashboard/submission/${point.submission_id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {point.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{point.label}</span>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className={cn(
                      "font-medium",
                      point.level < point.expected ? "text-warning" : "text-foreground",
                    )}
                  >
                    L{point.level}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">L{point.expected}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {formatDate(point.submitted_at)}
                </td>
                {showBand ? (
                  <td className="py-2.5">
                    {point.ai_band ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-caption font-medium",
                          aiBandBadgeClass(point.ai_band),
                        )}
                      >
                        {aiBandLabel(point.ai_band)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string;
  value: string;
  caption: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-bold",
          tone === "warning" ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-caption text-muted-foreground">{caption}</p>
    </div>
  );
}
