import { Children, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Kartu kelas berjajar ke samping. Dua kartu pas selebar baris; lebih dari dua, kartu ketiga
 * mengintip supaya jelas bahwa daftarnya bisa digeser. Dipakai mahasiswa dan dosen.
 */
export function ClassCarousel({ label, children }: { label: string; children: ReactNode }) {
  const items = Children.toArray(children);
  const scrolls = items.length > 2;
  return (
    <ul
      className={cn(
        "-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1",
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
