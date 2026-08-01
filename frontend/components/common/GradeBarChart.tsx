"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
} from "recharts";

import { CHART_COLORS } from "@/lib/ui";

export interface GradePoint {
  label: string;
  value: number;
}

interface Props {
  data: GradePoint[];
  height?: number;
}

// Bar nilai tugas terakhir. Bar dengan nilai tertinggi diberi warna teal penuh.
export function GradeBarChart({ data, height = 200 }: Props) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={44}>
          <LabelList
            dataKey="value"
            position="top"
            fill={CHART_COLORS.axis}
            fontSize={12}
            fontWeight={700}
          />
          {data.map((point, index) => (
            <Cell
              key={index}
              fill={point.value === max ? CHART_COLORS.primary : CHART_COLORS.mint}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
