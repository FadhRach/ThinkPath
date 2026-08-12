"use client";

import { useId } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CohortTrendPoint } from "@/lib/types";
import { CHART_COLORS } from "@/lib/ui";

interface Props {
  points: CohortTrendPoint[];
  height?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CohortTrendPoint }>;
}

function CohortTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  const gap = point.level - point.expected;
  return (
    <div className="max-w-[16rem] space-y-1 rounded-lg border border-border bg-card px-3 py-2 shadow-soft">
      <p className="text-body-sm font-semibold text-foreground">{point.title}</p>
      <p className="text-caption text-muted-foreground">
        Rata-rata kelas L{point.level} terhadap target L{point.expected}
      </p>
      <p className="text-caption font-medium text-foreground">
        {gap <= -1 ? `Kelas tertinggal ${Math.abs(gap).toFixed(2)} tingkat` : "Kelas mengikuti tuntutan"}
      </p>
    </div>
  );
}

/**
 * Rata rata level Bloom kelas terhadap target, tugas demi tugas.
 *
 * Dua garis, bukan satu. Garis kelas sendirian hanya bercerita soal gerakan,
 * sedangkan yang perlu dijawab adalah gerakan terhadap tuntutan yang naik.
 * Kelas yang datar sementara targetnya menanjak sebetulnya sedang tertinggal
 * makin jauh, dan itu tidak terlihat tanpa garis pembandingnya.
 */
export function CohortTrendChart({ points, height = 240 }: Props) {
  const gradientId = useId().replace(/:/g, "");

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-body-sm text-muted-foreground">
        Belum ada tugas yang dianalisis.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={points} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.24} />
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
          tickFormatter={(value: number) => `L${value}`}
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
        />
        <Tooltip content={<CohortTooltip />} cursor={{ stroke: CHART_COLORS.grid }} />
        <Area
          type="monotone"
          dataKey="level"
          stroke={CHART_COLORS.primary}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={{ fill: CHART_COLORS.primary, r: 4, strokeWidth: 0 }}
        />
        <Line
          type="stepAfter"
          dataKey="expected"
          stroke="hsl(var(--warning))"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
