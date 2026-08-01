"use client";

import { ErrorState } from "@/components/ErrorState";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Terjadi kesalahan"
      caption="Ada masalah saat memuat halaman. Periksa koneksi internetmu lalu coba lagi."
      onRetry={reset}
    />
  );
}
