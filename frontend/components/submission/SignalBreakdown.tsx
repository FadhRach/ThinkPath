import type { SignalContribution } from "@/lib/types";

interface Props {
  breakdown: SignalContribution[] | null;
}

/**
 * Rincian dari mana angka persentase itu berasal.
 *
 * Mengikuti pola "Rincian 4 Sinyal" pada desain referensi (frame 1d Result
 * Card): nama sinyal di kiri, nilai di kanan, batang selebar nilai di bawahnya.
 *
 * Perbedaan yang disengaja terhadap desain: desain menampilkan empat sinyal
 * blueprint (perplexity, stilometri, klasifikator IndoBERT, forensik proses)
 * yang semuanya belum ada implementasinya. Komponen ini menampilkan sinyal yang
 * benar benar dihitung backend hari ini, lengkap dengan bobotnya, supaya layar
 * guru tidak menjanjikan sesuatu yang tidak dihitung.
 */
function toneFor(value: number) {
  if (value >= 70) return { bar: "bg-danger", text: "text-danger" };
  if (value >= 40) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-primary", text: "text-primary" };
}

export function SignalBreakdown({ breakdown }: Props) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) return null;

  const ranked = [...breakdown].sort((a, b) => b.contribution - a.contribution);
  const total = ranked.reduce((sum, item) => sum + item.contribution, 0);

  return (
    <div className="space-y-4">
      {ranked.map((item, index) => {
        const value = Math.round(item.value * 100);
        const tone = toneFor(value);
        return (
          <div key={item.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body-sm font-medium text-foreground">
                S{index + 1} &middot; {item.label}
              </span>
              <span className={`text-body-sm font-semibold tabular-nums ${tone.text}`}>
                {value}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${tone.bar}`}
                style={{ width: `${value}%` }}
              />
            </div>
            <p className="text-body-sm text-muted-foreground">{item.evidence}</p>
            <p className="text-caption text-muted-foreground">
              Bobot {Math.round(item.weight * 100)}% &middot; menyumbang{" "}
              {item.contribution.toFixed(1)} poin ke skor akhir
            </p>
          </div>
        );
      })}
      <p className="border-t border-border pt-3 text-body-sm text-muted-foreground">
        Jumlah kontribusi {total.toFixed(1)} dari 100. Bobot tiap sinyal masih berupa
        titik awal dan belum dikalibrasi terhadap data berlabel guru, jadi angka ini
        bahan tinjau, bukan vonis.
      </p>
    </div>
  );
}
