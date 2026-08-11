"use client";

import { useId } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { BloomDistributionBin } from "@/lib/types";
import { CHART_COLORS } from "@/lib/ui";

interface Props {
  bins: BloomDistributionBin[];
  /** Target rata rata kelas, digambar sebagai garis pemisah. */
  target?: number | null;
  height?: number;
}

/**
 * Sebaran level Bloom seluruh submission di satu kelas.
 *
 * Batang di kiri garis target adalah pekerjaan yang belum sampai ke tuntutan
 * tugas. Bentuk histogram dipilih karena pertanyaannya soal bentuk sebaran,
 * bukan soal siapa: kelas yang menumpuk di L1 dan L4 tanpa isi di tengah
 * menuntut respons yang berbeda dari kelas yang seluruhnya berkumpul di L2.
 */
export function BloomDistributionChart({ bins, target, height = 220 }: Props) {
  const gradientId = useId().replace(/:/g, "");
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-body-sm text-muted-foreground">
        Belum ada submission yang dianalisis.
      </p>
    );
  }

  const data = bins.map((bin) => ({
    ...bin,
    name: `L${bin.level}`,
    below: target != null && bin.level < target,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.95} />
            <stop offset="100%" stopColor={CHART_COLORS.light} stopOpacity={0.75} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
        />
        {target != null ? (
          <ReferenceLine
            // Sumbu X kategorikal, jadi garis hanya bisa berdiri di salah satu
            // batang. Target pecahan dibulatkan, dan angka aslinya tetap
            // ditulis pada label supaya pembulatan itu tidak menyesatkan.
            x={`L${Math.round(target)}`}
            stroke="hsl(var(--warning))"
            strokeDasharray="4 4"
            label={{
              value: `Target L${target}`,
              position: "top",
              fill: CHART_COLORS.axis,
              fontSize: 11,
            }}
          />
        ) : null}
        <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={52}>
          <LabelList
            dataKey="count"
            position="top"
            fill={CHART_COLORS.axis}
            fontSize={12}
            fontWeight={700}
            formatter={(value: unknown) => (Number(value) > 0 ? String(value) : "")}
          />
          {data.map((bin) => (
            <Cell
              key={bin.level}
              fill={bin.below ? "hsl(var(--warning) / 0.55)" : `url(#${gradientId})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
