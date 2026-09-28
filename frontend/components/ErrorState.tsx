"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  caption: string;
  /** `reset` dari error boundary Next.js. */
  reset: () => void;
  /** Sidik galat dari Next.js, sama dengan yang tercatat di log server. */
  digest?: string;
}

/**
 * Tampilan untuk error boundary.
 *
 * `reset()` saja hanya me-render ulang di peramban dengan data yang sama, jadi
 * galat dari komponen server tetap tampil walau servernya sudah pulih.
 * `router.refresh()` meminta data baru ke server lebih dulu.
 */
export function ErrorState({ title, caption, reset, digest }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <h2 className="text-display-2 font-bold text-foreground">{title}</h2>
        <p className="text-body text-muted-foreground">{caption}</p>
        <Button type="button" onClick={retry} disabled={pending}>
          {pending ? "Memuat ulang..." : "Coba lagi"}
        </Button>
        {digest ? (
          <p className="text-caption text-muted-foreground">Kode galat: {digest}</p>
        ) : null}
      </div>
    </div>
  );
}
