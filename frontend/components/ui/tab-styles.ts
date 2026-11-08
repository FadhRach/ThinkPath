import { cn } from "@/lib/utils";

// Tanpa "use client" supaya server component (tab berupa tautan) bisa memakainya.
export const TAB_BASE =
  "inline-flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

export function tabLinkClass(active: boolean) {
  return cn(
    TAB_BASE,
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}
