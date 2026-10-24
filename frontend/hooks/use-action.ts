"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getApiErrorMessage } from "@/lib/api/messages";
import { notify } from "@/lib/notify";

interface ActionOptions {
  /** Toast yang tampil saat aksi berhasil. Kosong berarti tidak ada toast sukses. */
  successMessage?: string;
}

/**
 * Satu pola untuk semua tombol mutasi: jalankan aksi, tangkap pesan galat DRF,
 * lalu segarkan data DI DALAM transition, sehingga tombol tetap pending sampai data
 * baru benar-benar tampil, bukan kembali idle di atas data basi.
 *
 * Galat selalu muncul sebagai toast dan juga dikembalikan di `error` untuk form
 * yang ingin menampilkannya di dekat kolom isian.
 */
export function useAction(errorFallback: string, options: ActionOptions = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Menjalankan mutasi. Tanpa `onSuccess`, sukses diakhiri `router.refresh()`;
   * beri `onSuccess` untuk navigasi (refresh manual bila tetap perlu).
   * `ok` yang menandai sukses; jangan menguji `result` (bisa kosong).
   */
  async function run<T>(
    action: () => Promise<T>,
    onSuccess?: (result: T) => void,
  ): Promise<{ ok: boolean; result?: T }> {
    setError(null);
    setBusy(true);
    try {
      const result = await action();
      if (options.successMessage) notify.success(options.successMessage);
      startTransition(() => {
        if (onSuccess) onSuccess(result);
        else router.refresh();
      });
      return { ok: true, result };
    } catch (err) {
      const message = getApiErrorMessage(err, errorFallback);
      setError(message);
      notify.error(message);
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  return { pending: busy || isPending, error, setError, run, router };
}
