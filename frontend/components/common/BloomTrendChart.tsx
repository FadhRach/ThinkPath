"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartLegend } from "@/components/common/ChartLegend";
import { bloomShortLabel } from "@/lib/bloom";
import { CHART_COLORS } from "@/lib/ui";

export interface BloomPoint {
  label: string;
  level: number;
  /** Target tugas pada titik itu. Tanpa ini grafik hanya menunjukkan gerakan,
   *  bukan gerakan terhadap apa. */
  expected?: number;
  /** Judul tugas untuk tooltip. */
  title?: string;
}

interface Props {
  data: BloomPoint[];
  height?: number;
}

const TARGET_COLOR = "hsl(var(--warning))";

function formatLevel(value: number): string {
  return `L${value}`;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: BloomPoint }>;
}

function BloomTooltip({ active, payload }: TooltipPayload) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="max-w-[16rem] space-y-0.5 rounded-lg border border-border bg-card px-3 py-2 shadow-soft">
      <p className="text-caption font-medium text-foreground">
        {point.label}
        {point.title ? ` · ${point.title}` : ""}
      </p>
      <p className="text-caption text-muted-foreground">
        L{point.level} {bloomShortLabel(Math.round(point.level))}
        {point.expected != null ? `, target L${point.expected}` : ""}
      </p>
    </div>
  );
}

/**
 * Garis perkembangan level Bloom per tugas dinilai (kronologis).
 *
 * Target digambar PER TUGAS, bukan sebagai satu garis rata-rata. Garis
 * rata-rata L4.33 membuat jawaban L4 untuk tugas bertarget L4 tampak di bawah
 * target, klaim yang tidak didukung datanya.
 */
export function BloomTrendChart({ data, height = 220 }: Props) {
  // id gradien harus unik per instans. Halaman Profil Kognitif memasang satu
  // grafik per kelas, dan id yang dipatok tetap membuat semuanya merujuk ke
  // gradien pertama: HTML tidak sah, dan pewarnaan per grafik jadi mustahil.
  const gradientId = useId().replace(/:/g, "");
  const hasTarget = data.some((point) => point.expected != null);

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
              <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            padding={{ left: 16, right: 16 }}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
          />
          <YAxis
            domain={[1, 6]}
            ticks={[1, 2, 3, 4, 5, 6]}
            tickFormatter={formatLevel}
            tickLine={false}
            axisLine={false}
            width={34}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
          />
          <Tooltip content={<BloomTooltip />} cursor={{ stroke: CHART_COLORS.grid }} />
          <Area
            type="linear"
            dataKey="level"
            stroke={CHART_COLORS.primary}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={{ fill: CHART_COLORS.primary, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          {hasTarget ? (
            <Line
              type="linear"
              dataKey="expected"
              stroke={TARGET_COLOR}
              strokeWidth={2}
              strokeDasharray="5 4"
              // Titik tidak boleh mewarisi pola putus-putus garisnya.
              dot={{
                r: 3.5,
                fill: "hsl(var(--card))",
                stroke: TARGET_COLOR,
                strokeWidth: 2,
                strokeDasharray: "0",
              }}
              activeDot={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { label: "Level jawaban", color: CHART_COLORS.primary, shape: "line" },
          ...(hasTarget
            ? [{ label: "Target tugas", color: TARGET_COLOR, shape: "dashed" as const }]
            : []),
        ]}
      />
    </div>
  );
}
