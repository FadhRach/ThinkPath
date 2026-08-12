"use client";

import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import type { OverviewStudent } from "@/lib/types";
import { CHART_COLORS } from "@/lib/ui";

// Ambang band mengikuti score_to_band di backend. Kalau ambang di sana berubah,
// garis pemisah di sini ikut menyesatkan, jadi keduanya harus bergerak bersama.
const BAND_MID = 35;
const BAND_HIGH = 70;
const GAP_THRESHOLD = -1;

const Y_MIN = -5;
const Y_MAX = 2;

interface Props {
  students: OverviewStudent[];
  height?: number;
}

interface Point extends OverviewStudent {
  x: number;
  y: number;
}

function toPoints(students: OverviewStudent[]): Point[] {
  return students
    .filter((student) => student.gap !== null)
    .map((student) => ({ ...student, x: student.ai_mean, y: student.gap as number }));
}

function dotColor(point: Point): string {
  const behind = point.y <= GAP_THRESHOLD;
  const flagged = point.x >= BAND_HIGH;
  // Warna mengikuti tindakan yang perlu diambil, bukan tingkat kecurigaan.
  // Tertinggal dari target diberi warna paling menonjol karena itu satu
  // satunya kuadran yang terukur, bukan dugaan.
  if (behind && flagged) return "hsl(var(--danger))";
  if (behind) return "hsl(var(--warning))";
  if (flagged) return "hsl(var(--brand-teal))";
  return "hsl(var(--muted-foreground))";
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
}

function ScatterTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="max-w-[15rem] space-y-1 rounded-lg border border-border bg-card px-3 py-2 shadow-soft">
      <p className="text-body-sm font-semibold text-foreground">
        {point.display_name}
      </p>
      <p className="text-caption text-muted-foreground">
        Rata-rata skor AI {point.ai_mean} dari {point.submission_count} tugas
      </p>
      <p className="text-caption text-muted-foreground">
        Level L{point.current_level} terhadap target L{point.average_target}
      </p>
      <p className="text-caption font-medium text-foreground">
        {point.y <= GAP_THRESHOLD
          ? `Tertinggal ${Math.abs(point.y).toFixed(2)} tingkat`
          : "Sesuai tuntutan tugas"}
      </p>
    </div>
  );
}

/**
 * Sebaran mahasiswa pada dua sumbu: dugaan AI dan selisih Bloom terhadap target.
 *
 * Bentuknya sengaja bukan peringkat satu sumbu. Daftar terurut skor AI memaksa
 * dosen membaca kelasnya sebagai antrean tersangka, dan menyembunyikan kuadran
 * yang paling sering luput: skor AI rendah dengan selisih Bloom besar, yaitu
 * mahasiswa yang mengerjakan sendiri tetapi tidak sampai ke level yang diminta.
 * Mereka tidak akan pernah muncul di alat yang hanya menghitung kecurigaan.
 */
export function AiBloomScatter({ students, height = 340 }: Props) {
  const router = useRouter();
  const points = toPoints(students);

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-body-sm text-muted-foreground">
        Belum ada tugas yang dianalisis di kelas ini.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 16, right: 20, bottom: 28, left: 4 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />

        {/* Kuadran yang paling penting diberi latar samar supaya terbaca
            sebelum siapa pun membaca sumbunya. */}
        <ReferenceArea
          x1={0}
          x2={BAND_HIGH}
          y1={Y_MIN}
          y2={GAP_THRESHOLD}
          fill="hsl(var(--warning))"
          fillOpacity={0.07}
        />

        <XAxis
          type="number"
          dataKey="x"
          domain={[0, 100]}
          ticks={[0, 35, 70, 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
          label={{
            value: "Rata-rata skor AI",
            position: "insideBottom",
            offset: -16,
            fill: CHART_COLORS.axis,
            fontSize: 12,
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          domain={[Y_MIN, Y_MAX]}
          ticks={[-5, -4, -3, -2, -1, 0, 1, 2]}
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
          tickFormatter={(value: number) => (value > 0 ? `+${value}` : `${value}`)}
          label={{
            value: "Selisih Bloom",
            angle: -90,
            position: "insideLeft",
            fill: CHART_COLORS.axis,
            fontSize: 12,
          }}
        />
        <ZAxis range={[130, 130]} />

        <ReferenceLine
          x={BAND_MID}
          stroke={CHART_COLORS.axis}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
        />
        <ReferenceLine
          x={BAND_HIGH}
          stroke="hsl(var(--danger))"
          strokeDasharray="4 4"
          strokeOpacity={0.6}
        />
        <ReferenceLine
          y={GAP_THRESHOLD}
          stroke="hsl(var(--warning))"
          strokeDasharray="4 4"
          label={{
            value: "Batas tertinggal",
            position: "insideBottomLeft",
            fill: CHART_COLORS.axis,
            fontSize: 11,
          }}
        />
        <ReferenceLine y={0} stroke={CHART_COLORS.grid} />

        <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />

        <Scatter
          data={points}
          onClick={(point: unknown) => {
            const target = point as Point | undefined;
            if (target?.student_id) {
              router.push(`/dashboard/students/${target.student_id}`);
            }
          }}
          shape={(props: unknown) => {
            const { cx, cy, payload } = props as {
              cx: number;
              cy: number;
              payload: Point;
            };
            return (
              <circle
                cx={cx}
                cy={cy}
                r={7}
                fill={dotColor(payload)}
                fillOpacity={0.85}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                className="cursor-pointer"
              />
            );
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
