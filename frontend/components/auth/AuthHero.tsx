import { Brandmark } from "@/components/common/Brandmark";

const STATS = [
  { value: "6", label: "Sinyal analisis" },
  { value: "L1-L6", label: "Level Bloom" },
];

// Panel kiri halaman auth: latar gradien teal, headline, dan ringkasan nilai.
export function AuthHero() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-teal to-[hsl(178_85%_28%)] p-10 text-white lg:flex lg:flex-col">
      <span className="pointer-events-none absolute -right-16 top-10 h-72 w-72 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-white/5" />

      <div className="relative">
        <Brandmark wordmarkClassName="text-white" />
      </div>

      <div className="relative mt-auto space-y-6">
        <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
          Pahami cara mahasiswa berpikir, bukan hanya nilainya.
        </h2>
        <p className="max-w-md text-white/80">
          Analisis kognitif Taksonomi Bloom dan deteksi penggunaan AI dalam satu
          platform untuk dosen dan mahasiswa.
        </p>
        <div className="flex gap-3">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3"
            >
              <p className="text-2xl font-extrabold">{stat.value}</p>
              <p className="text-sm text-white/75">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="relative mt-10 text-sm text-white/60">
        &copy; 2026 Tim DataDigger &middot; GEMASTIK
      </p>
    </div>
  );
}
