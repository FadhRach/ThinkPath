import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CekPahamFlow } from "@/components/student/cekpaham/CekPahamFlow";
import { ApiError } from "@/lib/api";
import { getStudentCekPaham } from "@/lib/data";

export default async function StudentCekPahamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let cekpaham;
  try {
    cekpaham = await getStudentCekPaham(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <nav aria-label="Lokasi halaman" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Link href="/student" className="hover:text-primary">Beranda</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span aria-current="page" className="truncate text-foreground">Cek Paham</span>
      </nav>

      <section className="rounded-xl border border-border bg-card px-5 py-5 sm:px-7 sm:py-6">
        <p className="caption-eyebrow text-primary">Cek Paham</p>
        <h1 className="mt-1.5 text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[1.8rem]">
          {cekpaham.assignment_title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{cekpaham.class_name}</p>
      </section>

      <CekPahamFlow initial={cekpaham} />
    </div>
  );
}
