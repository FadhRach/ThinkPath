"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  /** Selalu tampil di ujung kanan judul, juga saat bagian ditutup (mis. ringkasan angka). */
  summary?: ReactNode;
  /** Di samping judul, di luar tombol buka-tutup (mis. InfoHint). */
  hint?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Bagian halaman yang bisa dibuka-tutup. Isinya hanya dipasang saat terbuka. */
export function CollapsibleSection({
  title,
  summary,
  hint,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="space-y-3">
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
            aria-hidden="true"
          />
          <h2 className="text-heading font-semibold">{title}</h2>
        </button>
        {hint}
        {summary ? <div className="ml-auto flex items-center gap-2">{summary}</div> : null}
      </div>
      <div id={contentId} hidden={!open}>
        {open ? children : null}
      </div>
    </section>
  );
}
