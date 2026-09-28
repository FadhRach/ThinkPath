"use client";

import { ErrorState } from "@/components/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Data dasbor gagal dimuat"
      caption="Server ThinkPath sedang bermasalah atau tidak dapat dihubungi. Coba lagi beberapa saat lagi."
      reset={reset}
      digest={error.digest}
    />
  );
}
