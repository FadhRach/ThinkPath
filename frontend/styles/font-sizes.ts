/**
 * Ukuran huruf kustom: satu sumber untuk tailwind.config.ts (membuat kelas `text-*`) dan
 * lib/utils.ts (memberi tahu tailwind-merge bahwa `text-micro` dkk. adalah ukuran, bukan warna).
 * Bila keduanya menyimpang, `cn()` diam-diam membuang kelas warna seperti `text-warning`.
 */
export const FONT_SIZES = {
  // Judul halaman fluid, judul bagian, dan teks mikro badge.
  title: [
    "clamp(1.6rem, 1.25rem + 1.2vw, 2.1rem)",
    { lineHeight: "1.15", letterSpacing: "-0.02em" },
  ],
  heading: ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
  micro: ["0.6875rem", { lineHeight: "1.35", letterSpacing: "0.01em" }],
  "display-2": ["1.875rem", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
  "body-lg": ["1.0625rem", { lineHeight: "1.65" }],
  body: ["0.9375rem", { lineHeight: "1.6" }],
  "body-sm": ["0.8125rem", { lineHeight: "1.55" }],
  caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.03em" }],
} satisfies Record<string, [string, { lineHeight: string; letterSpacing?: string }]>;
