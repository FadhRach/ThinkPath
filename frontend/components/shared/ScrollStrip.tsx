import { Children, type ReactNode } from "react";

interface ScrollStripProps {
  label: string;
  children: ReactNode;
}

/** Lebar <li> tetap supaya kartu berikutnya mengintip, tanda bahwa deret ini bisa digeser. */
export function ScrollStrip({ label, children }: ScrollStripProps) {
  return (
    <ul
      aria-label={label}
      className="scrollbar-thin -m-1 flex snap-x snap-proximity scroll-px-1 gap-3 overflow-x-auto overscroll-x-contain scroll-smooth rounded-xl p-1 pb-2"
    >
      {Children.toArray(children).map((child, index) => (
        <li key={index} className="w-64 shrink-0 snap-start sm:w-72">
          {child}
        </li>
      ))}
    </ul>
  );
}
