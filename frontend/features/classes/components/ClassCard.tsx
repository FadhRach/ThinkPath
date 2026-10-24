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
}

/** Kartu kelas bersama untuk dosen dan mahasiswa; hanya isi `details` dan `status` yang berbeda. */
export function ClassCard({ href, name, details, status }: ClassCardProps) {
  return (
    <Card className="h-full overflow-hidden">
      <Link href={href} className="block h-full p-5 transition-colors hover:bg-accent/40">
        <h3 className="text-heading font-semibold">{name}</h3>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">{details}</div>
        <div className="mt-5 border-t border-border pt-4 text-sm">{status}</div>
        <p className="mt-4 text-sm font-semibold text-brand-ink">
          Buka kelas <span aria-hidden="true">→</span>
        </p>
      </Link>
    </Card>
  );
}
