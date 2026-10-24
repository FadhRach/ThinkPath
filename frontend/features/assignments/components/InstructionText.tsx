"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const COLLAPSE_AFTER = 420;

/** Instruksi tugas. Yang panjang diringkas empat baris dan bisa dibuka penuh. */
export function InstructionText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > COLLAPSE_AFTER;

  if (!text.trim()) {
    return <p className="text-sm text-muted-foreground">Dosen belum menulis instruksi tugas.</p>;
  }

  return (
    <div>
      <p
        className={cn(
          "whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:text-base sm:leading-7",
          long && !open && "line-clamp-4",
        )}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="mt-1.5 text-sm font-semibold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? "Tampilkan lebih sedikit" : "Baca selengkapnya"}
        </button>
      ) : null}
    </div>
  );
}
