"use client";

import { ErrorState } from "@/components/ErrorState";

export default function StudentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Gagal memuat halaman mahasiswa"
      caption="Server sedang tidak bisa dihubungi. Coba muat ulang beberapa saat lagi."
      onRetry={reset}
    />
  );
}
