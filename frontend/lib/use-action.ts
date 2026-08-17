"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getApiErrorMessage } from "./api-shared";

// Satu pola untuk semua tombol mutasi: jalankan aksi, tangkap pesan galat DRF,
// lalu segarkan data DI DALAM transition — tombol tetap pending sampai data
// baru benar-benar tampil, bukan kembali idle di atas data basi.
export function useAction(errorFallback: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Menjalankan mutasi. Tanpa `onSuccess`, sukses diakhiri `router.refresh()`;
   * beri `onSuccess` untuk navigasi (refresh manual bila tetap perlu).
   * `ok` yang menandai sukses — jangan menguji `result` (bisa kosong).
   */
  async function run<T>(
    action: () => Promise<T>,
    onSuccess?: (result: T) => void,
  ): Promise<{ ok: boolean; result?: T }> {
    setError(null);
    setBusy(true);
    try {
      const result = await action();
      startTransition(() => {
        if (onSuccess) onSuccess(result);
        else router.refresh();
      });
      return { ok: true, result };
    } catch (err) {
      setError(getApiErrorMessage(err, errorFallback));
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  return { pending: busy || isPending, error, setError, run, router };
}
