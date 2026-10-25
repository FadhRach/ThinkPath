"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

/**
 * Tombol "Coba lagi" untuk error boundary.
 *
 * `reset()` saja hanya me-render ulang di peramban dengan data yang sama, jadi galat
 * dari komponen server tetap tampil walau servernya sudah pulih. `router.refresh()`
 * meminta data baru ke server lebih dulu.
 */
export function RetryButton({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          router.refresh();
          reset();
        })
      }
    >
      {pending ? "Memuat ulang..." : "Coba lagi"}
    </Button>
  );
}
