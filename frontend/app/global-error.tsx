"use client";

import "@/styles/tokens.css";
import "./globals.css";

// Cadangan terakhir bila layout akar sendiri gagal: harus membawa <html> dan <body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-title font-extrabold">Terjadi kesalahan</h1>
          <p className="text-body text-muted-foreground">
            ThinkPath tidak dapat dimuat. Muat ulang halaman, atau coba lagi beberapa saat lagi.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Muat ulang
          </button>
          {error.digest ? (
            <p className="text-caption text-muted-foreground">Kode galat: {error.digest}</p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
