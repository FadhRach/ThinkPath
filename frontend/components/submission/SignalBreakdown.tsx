import type { SignalContribution } from "@/lib/types";

interface Props {
  breakdown: SignalContribution[] | null;
}

/**
 * Rincian dari mana angka persentase itu berasal.
 *
 * Dua kelompok baris:
 * - **Penyumbang skor** (bobot > 0): jumlah kontribusinya merekonstruksi skor
 *   akhir, supaya panel ini tidak pernah berbohong soal asal angkanya.
 * - **Pembanding heuristik** (bobot 0): muncul ketika skor datang dari
 *   detektor/Groq. Kelima sinyal gaya teks tetap dihitung agar dosen bisa
 *   membedahnya, tetapi sengaja tidak menyumbang skor — penilai eksternal dan
 *   sinyal ini membaca teks yang sama, dan menjumlahkan keduanya berarti
 *   menghitung ganda bukti yang sama.
 */
function toneFor(value: number) {
  if (value >= 70) return { bar: "bg-danger", text: "text-danger" };
  if (value >= 40) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-primary", text: "text-primary" };
}

function SignalRow({
  item,
  index,
  contributes,
}: {
  item: SignalContribution;
  index: number;
  contributes: boolean;
}) {
  const value = Math.round(item.value * 100);
  const tone = toneFor(value);
  return (
    <div className="space-y-1.5">
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
        {contributes
          ? `Bobot ${Math.round(item.weight * 100)}% · menyumbang ${item.contribution.toFixed(1)} poin ke skor akhir`
          : "Pembanding · tidak menyumbang skor"}
      </p>
    </div>
  );
}

export function SignalBreakdown({ breakdown }: Props) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) return null;

  const contributing = breakdown
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.contribution - a.contribution);
  const context = breakdown.filter((item) => item.weight === 0);
  const total = contributing.reduce((sum, item) => sum + item.contribution, 0);

  return (
    <div className="space-y-4">
      {contributing.map((item, index) => (
        <SignalRow key={item.key} item={item} index={index} contributes />
      ))}

      <p className="border-t border-border pt-3 text-body-sm text-muted-foreground">
        Jumlah kontribusi {total.toFixed(1)} dari 100. Bobot tiap sinyal masih berupa
        titik awal dan belum dikalibrasi terhadap data berlabel dosen, jadi angka ini
        bahan tinjau, bukan vonis.
      </p>

      {context.length > 0 ? (
        <div className="space-y-4 rounded-xl bg-muted/40 p-4">
          <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
            Pembanding heuristik — tidak menyumbang skor
          </p>
          <p className="text-caption text-muted-foreground">
            Skor di atas berasal dari penilai eksternal. Lima sinyal gaya teks di
            bawah tetap dihitung sebagai pembanding; keduanya membaca teks yang
            sama, jadi menjumlahkannya berarti menghitung bukti yang sama dua kali.
          </p>
          {context.map((item, index) => (
            <SignalRow
              key={item.key}
              item={item}
              index={contributing.length + index}
              contributes={false}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
