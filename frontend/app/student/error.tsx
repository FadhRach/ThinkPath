"use client";

import { ErrorState } from "@/components/ErrorState";

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Halaman gagal dimuat"
      caption="Server ThinkPath sedang bermasalah atau tidak dapat dihubungi. Coba lagi beberapa saat lagi."
      reset={reset}
      digest={error.digest}
    />
  );
}
