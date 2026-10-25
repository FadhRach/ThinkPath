"use client";

import { useEffect, useRef, useState } from "react";

import { LazyRichContent } from "@/features/editor/components/LazyEditors";
import type { RichDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLLAPSE_AFTER = 420;
const COLLAPSED_PX = 220;

interface InstructionTextProps {
  text: string;
  /** Instruksi berformat; bila ada, ini yang ditampilkan dan `text` hanya cadangan. */
  rich?: RichDoc | null;
}

/** Instruksi tugas. Yang panjang diringkas dan bisa dibuka penuh; berformat bila dosen memakai editor. */
export function InstructionText({ text, rich }: InstructionTextProps) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const hasRich = !!rich && (rich.content?.length ?? 0) > 0;

  // Isi berformat tingginya baru diketahui setelah dirender (gambar, tabel), jadi diukur.
  useEffect(() => {
    if (!hasRich || !box.current) return;
    const node = box.current;
    const measure = () => setOverflows(node.scrollHeight > COLLAPSED_PX + 8);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasRich, rich]);

  if (hasRich) {
    return (
      <div>
        <div
          ref={box}
          className={cn("relative overflow-hidden", !open && overflows && "max-h-[220px]")}
        >
          <LazyRichContent doc={rich} />
          {!open && overflows ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent"
              aria-hidden="true"
            />
          ) : null}
        </div>
        {overflows ? (
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
