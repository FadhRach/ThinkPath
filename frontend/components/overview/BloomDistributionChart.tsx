"use client";

import {
  Bar,
  BarChart,
  LabelList,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartLegend } from "@/components/common/ChartLegend";
import { bloomShortLabel } from "@/lib/bloom";
import type { BloomDistributionBin } from "@/lib/types";
import { CHART_COLORS } from "@/lib/ui";

interface Props {
  bins: BloomDistributionBin[];
  height?: number;
}

interface Datum {
  name: string;
  level: number;
  count: number;
  below: number;
  met: number;
}

const BELOW_COLOR = "hsl(var(--warning))";
const MET_COLOR = CHART_COLORS.primary;
const BAR_RADIUS = 8;

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Datum }>;
  split: boolean;
}

function DistributionTooltip({ active, payload, split }: TooltipProps) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;

  return (
    <div className="space-y-0.5 rounded-lg border border-border bg-card px-3 py-2 shadow-soft">
      <p className="text-body-sm font-semibold text-foreground">
        {datum.name} {bloomShortLabel(datum.level)}
      </p>
      <p className="text-caption text-muted-foreground">{datum.count} jawaban</p>
      {split && datum.count > 0 ? (
        <p className="text-caption text-muted-foreground">
          {datum.below} di bawah target tugasnya, {datum.met} memenuhi
        </p>
      ) : null}
    </div>
  );
}

/**
 * Batang bertumpuk hanya membulatkan ujung segmen yang berada paling atas.
 * Segmen "di bawah target" menjadi puncak ketika tidak ada jawaban yang
 * memenuhi target pada level itu.
 */
function segmentShape(segment: "below" | "met") {
  return function SegmentShape(props: unknown) {
    const { payload, ...rect } = props as { payload: Datum } & Record<string, unknown>;
    const onTop = segment === "met" || payload.met === 0;
    return (
      <Rectangle
        {...rect}
        radius={onTop ? [BAR_RADIUS, BAR_RADIUS, 0, 0] : 0}
      />
    );
  };
}

/**
 * Sebaran level Bloom seluruh submission di satu kelas.
 *
 * Bentuk histogram dipilih karena pertanyaannya soal bentuk sebaran, bukan
 * soal siapa: kelas yang menumpuk di L1 dan L4 tanpa isi di tengah menuntut
 * respons yang berbeda dari kelas yang seluruhnya berkumpul di L2.
 *
 * Tiap batang dibelah menurut target TUGASNYA masing-masing, bukan menurut
 * rata-rata target kelas. Garis rata-rata pada sumbu kategorikal dulu jatuh
 * tepat di tengah batang L4 dan mewarnai seluruh L4 sebagai tertinggal,
 * padahal sebagian jawaban L4 menjawab tugas yang memang bertarget L4.
 */
export function BloomDistributionChart({ bins, height = 220 }: Props) {
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-body-sm text-muted-foreground">
        Belum ada submission yang dianalisis.
      </p>
    );
  }

  // Backend lama belum mengirim below_target. Tanpa data itu batang tidak
  // dibelah sama sekali, daripada ditebak dari rata-rata target.
  const split = bins.every((bin) => typeof bin.below_target === "number");
  const data: Datum[] = bins.map((bin) => {
    const below = split ? Math.min(bin.below_target ?? 0, bin.count) : 0;
    return {
      name: `L${bin.level}`,
      level: bin.level,
      count: bin.count,
      below,
      met: bin.count - below,
    };
  });

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
          />
          <YAxis hide allowDecimals={false} />
          <Tooltip
            content={<DistributionTooltip split={split} />}
            cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.6 }}
          />
          <Bar
            dataKey="below"
            stackId="level"
            fill={BELOW_COLOR}
            maxBarSize={52}
            shape={segmentShape("below")}
          />
          <Bar
            dataKey="met"
            stackId="level"
            fill={MET_COLOR}
            maxBarSize={52}
            shape={segmentShape("met")}
          >
            <LabelList
              dataKey="count"
              position="top"
              fill={CHART_COLORS.axis}
              fontSize={12}
              fontWeight={700}
              formatter={(value: unknown) => (Number(value) > 0 ? String(value) : "")}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {split ? (
        <ChartLegend
          items={[
            { label: "Di bawah target tugasnya", color: BELOW_COLOR },
            { label: "Memenuhi target", color: MET_COLOR },
          ]}
        />
      ) : null}
    </div>
  );
}
