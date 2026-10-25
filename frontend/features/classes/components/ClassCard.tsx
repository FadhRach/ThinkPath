import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

interface ClassCardProps {
  href: string;
  name: string;
  /** Baris keterangan redup di bawah nama (mata kuliah, dosen, jenjang, dst.). */
  details: ReactNode;
  /** Status kelas di bagian bawah kartu (tugas berikutnya, jumlah yang perlu diperiksa, dst.). */
  status: ReactNode;
  /** Teks tautan di dasar kartu. Diabaikan bila `actions` diberikan. */
  linkLabel?: string;
  /** Tombol pintasan di dasar kartu; tetap bisa diklik walau seluruh kartu adalah tautan. */
  actions?: ReactNode;
}

/**
 * Kartu kelas bersama untuk dosen dan mahasiswa; hanya isi `details` dan `status` yang berbeda.
 * Seluruh kartu bisa diklik lewat tautan pada judul yang direntangkan (bukan `<a>` pembungkus),
 * sehingga tombol pintasan di dalamnya tidak menjadi tautan di dalam tautan.
 */
export function ClassCard({
  href,
  name,
  details,
  status,
  linkLabel = "Buka kelas",
  actions,
}: ClassCardProps) {
  return (
    <Card className="relative h-full overflow-hidden transition-colors focus-within:ring-2 focus-within:ring-ring/60 hover:bg-accent/40">
      <div className="flex h-full flex-col p-5">
        <h3 className="text-heading font-semibold">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {name}
          </Link>
        </h3>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">{details}</div>
        <div className="mt-5 flex-1 border-t border-border pt-4 text-sm">{status}</div>
        {actions ? (
          <div className="relative z-10 mt-4 flex gap-2">{actions}</div>
        ) : (
          <p className="mt-4 text-sm font-semibold text-brand-ink">
            {linkLabel} <span aria-hidden="true">→</span>
          </p>
        )}
      </div>
    </Card>
  );
}
