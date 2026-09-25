import Link from "next/link";

import { Brandmark } from "@/components/common/Brandmark";

// Halaman lain belum ada, jadi tetap tampil redup seperti menu yang belum
// aktif di navigasi atas, bukan teks yang seolah bisa diklik.
const PENDING_LINKS = ["Panduan", "Bantuan", "Hubungi Kampus"];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <Brandmark wordmarkClassName="text-base" />
          <span className="hidden text-muted-foreground sm:inline">
            Lihat proses berpikirnya, bukan hanya nilainya
          </span>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 lg:ml-auto">
          <li>
            <Link
              href="/kebijakan-privasi"
              className="font-medium text-foreground/80 transition hover:text-primary"
            >
              Kebijakan Privasi
            </Link>
          </li>
          {PENDING_LINKS.map((link) => (
            <li
              key={link}
              title="Segera hadir"
              className="cursor-not-allowed text-muted-foreground/60"
            >
              {link}
            </li>
          ))}
        </ul>
        <span className="text-xs text-muted-foreground/70">
          &copy; 2026 Tim DataDigger
        </span>
      </div>
    </footer>
  );
}
