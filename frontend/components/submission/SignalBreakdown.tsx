import type { AnalysisSource, SignalContribution } from "@/lib/types";

interface Props {
  breakdown: SignalContribution[] | null;
  source?: AnalysisSource;
}

// Ambang band ditandai pada bar komposisi supaya dosen melihat posisi skor
// terhadap batas sedang dan tinggi. Detektor eksternal punya ambangnya sendiri
// (academics/detector.py), jalur lain memakai ambang heuristik
// (academics/ai_score.py). Keduanya wajib ikut bila backend bergeser.
const BAND_HIGH = 70;

function midThreshold(source: AnalysisSource | undefined): number {
  return source === "detector" ? 35 : 42;
}

// Satu rona teal dengan kepekatan menurun. Warna sengaja tidak memakai merah:
// sinyal berbobot kecil yang bernilai penuh dulu tampil sebagai bar merah
// penuh, padahal sumbangannya ke skor hanya beberapa poin.
const SEGMENT_OPACITY = [1, 0.72, 0.52, 0.38, 0.26, 0.18];

function segmentColor(index: number): string {
  const opacity = SEGMENT_OPACITY[Math.min(index, SEGMENT_OPACITY.length - 1)];
  return `hsl(var(--brand-teal) / ${opacity})`;
}

function provenanceNote(source: AnalysisSource | undefined): string {
  if (source === "detector") {
    return "Porsi teks berasal dari detektor eksternal yang ketepatannya belum kami ukur sendiri. Ambang 35 dan 70 untuk detektor, juga bobot forensik proses, belum dikalibrasi.";
  }
  if (source === "llm") {
    return "Porsi teks berasal dari model bahasa yang ketepatannya belum kami ukur sendiri. Ambangnya meminjam 42 dan 70 dari heuristik, dan bobot forensik proses belum terukur.";
  }
  return "Bobot sinyal teks dan ambang sedang 42 diukur pada 999 abstrak akademik publik, bukan pada esai mahasiswa berlabel dosen. Bobot forensik proses dan ambang tinggi 70 belum terukur.";
}

/**
 * Rincian dari mana skor indikasi AI berasal.
 *
 * Dua kelompok baris:
 * - **Penyumbang skor** (bobot > 0): jumlah kontribusinya merekonstruksi skor
 *   akhir, supaya panel ini tidak pernah berbohong soal asal angkanya.
 * - **Pembanding heuristik** (bobot 0): muncul ketika skor datang dari
 *   detektor/Groq. Kelima sinyal gaya teks tetap dihitung agar dosen bisa
 *   membedahnya, tetapi sengaja tidak menyumbang skor — penilai eksternal dan
 *   sinyal ini membaca teks yang sama, dan menjumlahkan keduanya berarti
 *   menghitung ganda bukti yang sama.
 *
 * Yang ditonjolkan adalah SUMBANGAN (nilai × bobot), bukan nilai mentah sinyal.
 */
export function SignalBreakdown({ breakdown, source }: Props) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) return null;

  const contributing = breakdown
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.contribution - a.contribution);
  const context = breakdown.filter((item) => item.weight === 0);
  const total = contributing.reduce((sum, item) => sum + item.contribution, 0);
  const bandMid = midThreshold(source);

  return (
    <div className="space-y-5">
      {contributing.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-caption text-muted-foreground">
            <span>Komposisi skor</span>
            <span className="font-semibold tabular-nums text-foreground">
              {total.toFixed(1)} dari 100
            </span>
          </div>
          <div className="relative">
            <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-muted">
              {contributing.map((item, index) => (
                <span
                  key={item.key}
                  className="h-full"
                  style={{
                    width: `${Math.max(0, item.contribution)}%`,
                    backgroundColor: segmentColor(index),
                  }}
                  title={`S${index + 1} ${item.label}: ${item.contribution.toFixed(1)} poin`}
                />
              ))}
            </div>
            {[bandMid, BAND_HIGH].map((mark) => (
              <span
                key={mark}
                aria-hidden="true"
                className="absolute -top-0.5 h-4 w-px bg-foreground/40"
                style={{ left: `${mark}%` }}
              />
            ))}
          </div>
          <div className="relative h-4 text-caption text-muted-foreground">
            <span className="absolute left-0">0</span>
            <span className="absolute -translate-x-1/2" style={{ left: `${bandMid}%` }}>
              {bandMid} sedang
            </span>
            <span className="absolute -translate-x-1/2" style={{ left: `${BAND_HIGH}%` }}>
              {BAND_HIGH} tinggi
            </span>
            <span className="absolute right-0">100</span>
          </div>
        </div>
      ) : null}

      <ul className="space-y-3.5">
        {contributing.map((item, index) => (
          <li key={item.key} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: segmentColor(index) }}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body-sm font-medium text-foreground">
                  S{index + 1} &middot; {item.label}
                </span>
                <span className="shrink-0 text-body-sm font-semibold tabular-nums text-foreground">
                  +{item.contribution.toFixed(1)}
                </span>
              </div>
              <p className="text-body-sm text-muted-foreground">{item.evidence}</p>
              <p className="text-caption text-muted-foreground">
                Nilai sinyal {Math.round(item.value * 100)} &times; bobot{" "}
                {Math.round(item.weight * 100)}%
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="border-t border-border pt-3 text-caption text-muted-foreground">
        {provenanceNote(source)} Angka ini bahan tinjau, bukan vonis.
      </p>

      {context.length > 0 ? (
        <div className="space-y-3 rounded-xl bg-muted/40 p-4">
          <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
            Pembanding heuristik, tidak menyumbang skor
          </p>
          <p className="text-caption text-muted-foreground">
            Skor di atas berasal dari penilai eksternal. Sinyal gaya teks di
            bawah tetap dihitung sebagai pembanding; keduanya membaca teks yang
            sama, jadi menjumlahkannya berarti menghitung bukti yang sama dua kali.
          </p>
          <ul className="space-y-3">
            {context.map((item) => (
              <li key={item.key} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
                    nilai {Math.round(item.value * 100)}
                  </span>
                </div>
                <p className="text-body-sm text-muted-foreground">{item.evidence}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
