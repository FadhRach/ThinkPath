import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { FONT_SIZES } from "@/styles/font-sizes";

// Tanpa daftar ini tailwind-merge membaca ukuran kustom (`text-micro`, `text-heading`) sebagai
// warna teks, lalu membuang `text-warning` atau ukuran itu sendiri saat digabung.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: Object.keys(FONT_SIZES) }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
