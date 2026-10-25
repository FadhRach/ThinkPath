"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { notify } from "@/lib/notify";

/** Kode gabung kelas dengan tombol salin, supaya mudah dibagikan ke mahasiswa. */
export function CopyJoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      notify.success("Kode kelas disalin.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Kode tidak bisa disalin otomatis. Salin secara manual.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Salin kode gabung ${code}`}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-1 tabular-nums text-sm font-bold tracking-wider text-brand-ink hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {code}
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
