import { Children, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Lebih dari dua kelas: kartu ketiga sengaja mengintip, tanda bahwa deret ini bisa digeser. */
export function ClassCarousel({ label, children }: { label: string; children: ReactNode }) {
  const items = Children.toArray(children);
  const scrolls = items.length > 2;
  return (
    <ul
      className={cn(
        // scroll-px sama dengan padding: kartu berhenti utuh, tepi dan sudutnya tidak terpotong.
        "scrollbar-thin -m-1 flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto overscroll-x-contain scroll-smooth rounded-xl p-1",
        scrolls && "pb-3",
      )}
      aria-label={label}
    >
      {items.map((item, index) => (
        <li
          key={index}
          className={cn(
            "min-w-0 shrink-0 snap-start basis-[85%]",
            scrolls ? "md:basis-[44%]" : "md:basis-[calc(50%-0.5rem)]",
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
