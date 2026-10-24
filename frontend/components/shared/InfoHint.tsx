import { Info } from "lucide-react";
import type { ReactNode } from "react";

interface InfoHintProps {
  /** Nama tombol untuk pembaca layar. */
  label: string;
  children: ReactNode;
}

/**
 * Ikon info yang membuka keterangan saat disorot kursor atau difokus (ketuk di ponsel).
 * Hanya CSS: tanpa state, jadi bisa dipakai di server component. Keterangannya menempel ke
 * elemen `relative` terdekat (bukan ke ikon), sehingga di ponsel selebar kontainernya dan tidak
 * keluar layar.
 */
export function InfoHint({ label, children }: InfoHintProps) {
  return (
    <span className="group inline-flex">
      <button
        type="button"
        aria-label={label}
        className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1 w-full rounded-lg border border-border bg-card p-3 text-left text-xs font-normal leading-relaxed text-foreground opacity-0 shadow-soft transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 sm:w-96"
      >
        {children}
      </span>
    </span>
  );
}
