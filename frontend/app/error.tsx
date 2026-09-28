"use client";

import { ErrorState } from "@/components/ErrorState";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Terjadi kesalahan"
      caption="Ada masalah saat memuat halaman. Periksa koneksi internet, lalu coba lagi."
      reset={reset}
      digest={error.digest}
    />
  );
}
