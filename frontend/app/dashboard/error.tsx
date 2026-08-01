"use client";

import { ErrorState } from "@/components/ErrorState";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Gagal memuat dashboard"
      caption="Server sedang tidak bisa dihubungi atau datanya bermasalah. Coba muat ulang; kalau berulang, pastikan backend berjalan."
      onRetry={reset}
    />
  );
}
