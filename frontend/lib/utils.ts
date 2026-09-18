import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Ukuran huruf kustom dari tailwind.config.ts WAJIB didaftarkan di sini.
// Tanpa daftar ini tailwind-merge membaca `text-body-sm` sebagai warna teks,
// lalu membuangnya begitu digabung dengan `text-muted-foreground`. Akibatnya
// badge dan pill diam-diam jatuh ke ukuran huruf induk dan tampak kebesaran.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display-1", "display-2", "body-lg", "body", "body-sm", "caption"] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
