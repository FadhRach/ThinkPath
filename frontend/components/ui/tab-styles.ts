import { cn } from "@/lib/utils";

// Gaya tab tanpa "use client", supaya server component (tab berbasis tautan) bisa memakainya
// dan tetap serupa dengan tab Radix di ui/tabs.tsx.

/** Bentuk dasar satu tab. */
export const TAB_BASE =
  "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

/** Kelas untuk tab yang berupa <Link> (navigasi lewat URL). */
export function tabLinkClass(active: boolean) {
  return cn(
    TAB_BASE,
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}
