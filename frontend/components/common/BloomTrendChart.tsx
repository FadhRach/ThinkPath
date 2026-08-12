"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { bloomShortLabel } from "@/lib/bloom";
import { CHART_COLORS } from "@/lib/ui";

export interface BloomPoint {
  label: string;
  level: number;
}

interface Props {
  data: BloomPoint[];
  height?: number;
  /** Garis acuan target dosen. Tanpa ini grafik hanya menunjukkan gerakan,
   *  bukan gerakan terhadap apa. */
  target?: number | null;
}

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
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-soft">
      <p className="text-caption font-medium text-foreground">{point.label}</p>
      <p className="text-caption text-muted-foreground">
        L{point.level} {bloomShortLabel(point.level)}
      </p>
    </div>
  );
}

// Garis perkembangan level Bloom per tugas dinilai (kronologis).
export function BloomTrendChart({ data, height = 220, target }: Props) {
  // id gradien harus unik per instans. Halaman Profil Kognitif memasang satu
  // grafik per kelas, dan id yang dipatok tetap membuat semuanya merujuk ke
  // gradien pertama: HTML tidak sah, dan pewarnaan per grafik jadi mustahil.
  const gradientId = useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.22} />
            <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
        />
        <YAxis
          domain={[1, 6]}
          ticks={[1, 2, 3, 4, 5, 6]}
          tickFormatter={formatLevel}
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
        />
        <Tooltip content={<BloomTooltip />} cursor={{ stroke: CHART_COLORS.grid }} />
        {target != null ? (
          <ReferenceLine
            y={target}
            stroke={CHART_COLORS.axis}
            strokeDasharray="4 4"
            label={{
              value: `Target L${target}`,
              position: "insideTopRight",
              fill: CHART_COLORS.axis,
              fontSize: 11,
            }}
          />
        ) : null}
        <Area
          type="monotone"
          dataKey="level"
          stroke={CHART_COLORS.primary}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={{ fill: CHART_COLORS.primary, r: 4, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
