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

// Garis bantu mengikuti ambang band heuristik di backend
// (academics/ai_score.py: MID_THRESHOLD 42 terukur, HIGH_THRESHOLD 70 belum).
// Sumbu datar grafik ini RATA-RATA skor, jadi garisnya hanya penunjuk arah,
// bukan band yang diberikan ke mahasiswa. Kalau ambang di backend bergeser,
// angka di sini wajib ikut bergeser.
const BAND_MID = 42;
const BAND_HIGH = 70;
const GAP_THRESHOLD = -1;

// Jarak geser (piksel) untuk titik yang koordinatnya persis sama.
const STACK_OFFSET_PX = 12;

interface Props {
  students: OverviewStudent[];
  height?: number;
}

interface Point extends OverviewStudent {
  x: number;
  y: number;
  stackIndex: number;
  stackSize: number;
}

/**
 * Mahasiswa dengan rata-rata skor dan selisih yang persis sama akan tergambar
 * sebagai SATU titik, dan salah satunya hilang dari peta tanpa jejak. Data
 * demo saja sudah memunculkan pasangan seperti itu. Titik berimpit diberi
 * urutan supaya bisa digeser beberapa piksel ke samping saat digambar;
 * koordinat datanya sendiri tidak diubah, dan tooltip menyebut pergeserannya.
 */
function toPoints(students: OverviewStudent[]): Point[] {
  const points: Point[] = students
    .filter((student) => student.gap !== null)
    .map((student) => ({
      ...student,
      x: student.ai_mean,
      y: student.gap as number,
      stackIndex: 0,
      stackSize: 1,
    }));

  const groups = new Map<string, Point[]>();
  for (const point of points) {
    const key = `${point.x}|${point.y}`;
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }
  groups.forEach((group) => {
    group.forEach((point, index) => {
      point.stackIndex = index;
      point.stackSize = group.length;
    });
  });
  return points;
}

/** Sumbu tegak secukupnya data, tetapi selalu memuat garis tertinggal dan nol. */
function yDomain(points: Point[]): [number, number] {
  const ys = points.map((point) => point.y);
  const lower = Math.max(-5, Math.min(-3, Math.floor(Math.min(...ys))));
  const upper = Math.min(5, Math.max(1, Math.ceil(Math.max(...ys))));
  return [lower, upper];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
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
    <div className="max-w-[16rem] space-y-1 rounded-lg border border-border bg-card px-3 py-2 shadow-soft">
      <p className="text-body-sm font-semibold text-foreground">{point.display_name}</p>
      <p className="text-caption text-muted-foreground">
        Rata-rata skor AI {point.ai_mean} dari {point.submission_count} tugas
      </p>
      <p className="text-caption text-muted-foreground">
        Level L{point.current_level}, target rata-rata L{point.average_target}
      </p>
      <p className="text-caption font-medium text-foreground">
        {point.y <= GAP_THRESHOLD
          ? `Tertinggal ${Math.abs(point.y).toFixed(2)} tingkat`
          : "Sesuai tuntutan tugas"}
      </p>
      {point.stackSize > 1 ? (
        <p className="text-caption text-muted-foreground">
          Berimpit dengan {point.stackSize - 1} mahasiswa lain; titiknya digeser
          sedikit agar semuanya terlihat.
        </p>
      ) : null}
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

  const [yMin, yMax] = yDomain(points);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 24, right: 16, bottom: 28, left: 4 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />

        {/* Kuadran yang paling penting diberi latar samar supaya terbaca
            sebelum siapa pun membaca sumbunya. */}
        <ReferenceArea
          x1={0}
          x2={BAND_HIGH}
          y1={yMin}
          y2={GAP_THRESHOLD}
          fill="hsl(var(--warning))"
          fillOpacity={0.08}
          stroke="none"
        />

        <XAxis
          type="number"
          dataKey="x"
          domain={[0, 100]}
          ticks={[0, BAND_MID, BAND_HIGH, 100]}
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
          domain={[yMin, yMax]}
          ticks={range(yMin, yMax)}
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
          strokeOpacity={0.35}
          label={{ value: "sedang", position: "top", fill: CHART_COLORS.axis, fontSize: 11 }}
        />
        <ReferenceLine
          x={BAND_HIGH}
          stroke="hsl(var(--danger))"
          strokeOpacity={0.45}
          label={{ value: "tinggi", position: "top", fill: CHART_COLORS.axis, fontSize: 11 }}
        />
        <ReferenceLine
          y={GAP_THRESHOLD}
          stroke="hsl(var(--warning))"
          strokeDasharray="5 4"
          label={{
            value: "Batas tertinggal",
            position: "insideBottomRight",
            fill: CHART_COLORS.axis,
            fontSize: 11,
          }}
        />
        <ReferenceLine y={0} stroke={CHART_COLORS.axis} strokeOpacity={0.35} />

        <Tooltip content={<ScatterTooltip />} cursor={false} />

        <Scatter
          data={points}
          shape={(props: unknown) => {
            const { cx, cy, payload } = props as {
              cx: number;
              cy: number;
              payload: Point;
            };
            const shift =
              (payload.stackIndex - (payload.stackSize - 1) / 2) * STACK_OFFSET_PX;
            return (
              <circle
                cx={cx + shift}
                cy={cy}
                r={7}
                fill={dotColor(payload)}
                fillOpacity={0.9}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                className="cursor-pointer"
                onClick={() => router.push(`/dashboard/students/${payload.student_id}`)}
              />
            );
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
