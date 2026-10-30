import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { AnalysisSource } from "@/lib/types";

/**
 * Menandai mesin yang menghasilkan SKOR AI pada satu hasil analisis.
 *
 * Tanpa penanda ini, skor heuristik tampil identik dengan skor detektor di layar
 * dosen. Dosen berhak tahu sumber angka yang sedang dilihatnya dan seberapa
 * sering sumber itu salah menuduh pada uji kami.
 *
 * Cakupannya sengaja sempit: yang ditandai hanya asal skor AI, bukan asal
 * seluruh baris. Level Bloom bisa datang dari mesin yang berbeda pada
 * submission yang sama, dan keyakinannya punya penandanya sendiri.
 */
const SOURCE_COPY: Record<AnalysisSource, { label: string; hint: string; tone: BadgeTone }> = {
  // Hanya ada pada hasil lama: sejak uji E1 Groq tidak lagi memberi skor AI.
  llm: {
    label: "Model bahasa (versi lama)",
    hint: "Skor ini dari versi lama yang meminta model bahasa menilai indikasi AI. Pada uji kami cara itu hampir setara tebakan; tekan Analisis Ulang untuk memakai rantai yang baru.",
    tone: "warning",
  },
  detector: {
    label: "Detektor eksternal",
    hint: "Skor AI berasal dari detektor khusus, sumber dengan salah tuduh terendah pada uji kami (2 dari 18 tulisan manusia). Sampelnya kecil, jadi angkanya tetap bahan tinjau, bukan kesimpulan. Nama penyedia dan versi modelnya tercatat di panel Asal Skor AI.",
    tone: "neutral",
  },
  heuristic: {
    label: "Sinyal teks",
    hint: "Detektor eksternal tidak tersedia atau tidak diizinkan, jadi skor dihitung dari sinyal gaya teks di server ThinkPath. Pada uji kami cara ini salah menuduh 11 dari 45 tulisan manusia; pakai sebagai indikasi kasar.",
    tone: "warning",
  },
  seed: {
    label: "Data demo",
    hint: "Baris ini berasal dari data contoh, bukan pengerjaan mahasiswa sungguhan.",
    tone: "info",
  },
};

export function AnalysisSourceBadge({ source }: { source: AnalysisSource }) {
  const copy = SOURCE_COPY[source];
  if (!copy) return null;
  return (
    <Badge tone={copy.tone} title={copy.hint}>
      {copy.label}
    </Badge>
  );
}

export function AnalysisSourceNote({ source }: { source: AnalysisSource }) {
  const copy = SOURCE_COPY[source];
  if (!copy) return null;
  return <p className="text-body-sm text-muted-foreground">{copy.hint}</p>;
}
