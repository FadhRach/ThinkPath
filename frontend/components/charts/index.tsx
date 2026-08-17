"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

// Recharts menyeret seluruh keluarga d3 ke bundel. Semua chart dimuat malas
// dari sini supaya halaman tanpa chart tidak ikut membayarnya; selama chart
// dimuat, skeleton setinggi chart menahan tata letak agar tidak melompat.
function chartSkeleton(height: number) {
  return function ChartSkeleton() {
    return <Skeleton style={{ height }} className="w-full rounded-xl" />;
  };
}

export const AiBloomScatter = dynamic(
  () => import("@/components/overview/AiBloomScatter").then((m) => m.AiBloomScatter),
  { ssr: false, loading: chartSkeleton(340) },
);

export const BloomDistributionChart = dynamic(
  () =>
    import("@/components/overview/BloomDistributionChart").then(
      (m) => m.BloomDistributionChart,
    ),
  { ssr: false, loading: chartSkeleton(220) },
);

export const CohortTrendChart = dynamic(
  () => import("@/components/overview/CohortTrendChart").then((m) => m.CohortTrendChart),
  { ssr: false, loading: chartSkeleton(240) },
);

export const BloomTrendChart = dynamic(
  () => import("@/components/common/BloomTrendChart").then((m) => m.BloomTrendChart),
  { ssr: false, loading: chartSkeleton(220) },
);

export const GradeBarChart = dynamic(
  () => import("@/components/common/GradeBarChart").then((m) => m.GradeBarChart),
  { ssr: false, loading: chartSkeleton(200) },
);

export type { GradePoint } from "@/components/common/GradeBarChart";
