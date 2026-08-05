import { ArrowRight, ScanSearch, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Brandmark } from "@/components/common/Brandmark";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Deteksi penggunaan AI",
    body: "Ensemble empat sinyal membaca pola teks dan proses menulis, bukan sekadar hasil akhir.",
  },
  {
    icon: TrendingUp,
    title: "Level kognitif Bloom",
    body: "Setiap jawaban dipetakan ke level L1-L6 agar dosen melihat cara mahasiswa berpikir.",
  },
  {
    icon: Sparkles,
    title: "Bukti, bukan vonis",
    body: "Skor jadi bahan verifikasi verbal dan umpan balik, keputusan tetap di tangan dosen.",
  },
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-6 py-6">
        <Brandmark />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Masuk</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Daftar</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1120px] px-6 py-16 text-center">
        <p className="caption-eyebrow text-primary">Integritas akademik K-12</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Pahami cara mahasiswa berpikir, bukan hanya nilainya.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-body-lg text-muted-foreground">
          ThinkPath merekam proses berpikir mahasiswa dan menyajikannya sebagai bukti
          yang dapat ditinjau: analisis Taksonomi Bloom dan deteksi penggunaan AI
          dalam satu platform untuk dosen dan mahasiswa.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">
              Mulai sekarang
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Masuk</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1120px] gap-4 px-6 pb-20 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-border bg-card p-6 shadow-soft"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
              <feature.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
            <p className="mt-1.5 text-body-sm text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
