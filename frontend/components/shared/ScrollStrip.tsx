import { Children, type ReactNode } from "react";

interface ScrollStripProps {
  /** Label aksesibel untuk daftar. */
  label: string;
  children: ReactNode;
}

/**
 * Deretan kartu kecil yang bisa digeser ke samping. Tiap anak dibungkus <li> selebar tetap,
 * sehingga kartu berikutnya selalu mengintip dan jelas bahwa daftarnya bisa digulir.
 */
export function ScrollStrip({ label, children }: ScrollStripProps) {
  return (
    <ul
      aria-label={label}
      className="-mx-1 flex snap-x snap-proximity gap-3 overflow-x-auto px-1 pb-2"
    >
      {Children.toArray(children).map((child, index) => (
        <li key={index} className="w-64 shrink-0 snap-start sm:w-72">
          {child}
        </li>
      ))}
    </ul>
  );
}
