"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS } from "@/lib/ui";

export interface BloomPoint {
  label: string;
  level: number;
}

interface Props {
  data: BloomPoint[];
  height?: number;
}

function formatLevel(value: number): string {
  return `L${value}`;
}

// Garis perkembangan level Bloom per tugas dinilai (kronologis).
export function BloomTrendChart({ data, height = 220 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="bloomFill" x1="0" y1="0" x2="0" y2="1">
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
        <Area
          type="monotone"
          dataKey="level"
          stroke={CHART_COLORS.primary}
          strokeWidth={2.5}
          fill="url(#bloomFill)"
          dot={{ fill: CHART_COLORS.primary, r: 4, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
