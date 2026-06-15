import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-8">
        <p className="caption-eyebrow">ThinkPath</p>
        <h1 className="font-display text-display-1">
          Bukti, bukan vonis.
        </h1>
        <p className="text-body-lg text-ink-muted">
          Platform integritas akademik untuk guru SMP/SMA/SMK di Indonesia.
          ThinkPath merekam proses berpikir siswa dan menyajikannya sebagai
          bukti yang dapat ditinjau, bukan skor sepihak.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="rounded-card bg-accent px-5 py-2.5 text-paper-elevated text-body hover:opacity-95 transition"
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className="rounded-card border border-border px-5 py-2.5 text-body hover:bg-accent-soft transition"
          >
            Daftar
          </Link>
        </div>
      </div>
    </main>
  );
}
