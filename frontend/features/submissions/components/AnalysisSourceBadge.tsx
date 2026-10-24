import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { AnalysisSource } from "@/lib/types";

/**
 * Menandai mesin yang menghasilkan SKOR AI pada satu hasil analisis.
 *
 * Tanpa penanda ini, hasil heuristik dangkal tampil identik dengan hasil LLM di
 * layar dosen. Dosen berhak tahu bahwa angka yang sedang dilihatnya berasal dari
 * hitungan cadangan, bukan dari analisis penuh.
 *
 * Cakupannya sengaja sempit: yang ditandai hanya asal skor AI, bukan asal
 * seluruh baris. Level Bloom bisa datang dari mesin yang berbeda pada
 * submission yang sama, dan keyakinannya punya penandanya sendiri.
 */
const SOURCE_COPY: Record<AnalysisSource, { label: string; hint: string; tone: BadgeTone }> = {
  llm: {
    label: "Analisis penuh",
    hint: "Dihitung oleh model bahasa.",
    tone: "neutral",
  },
  detector: {
    label: "Detektor eksternal",
    hint: "Skor AI berasal dari detektor khusus, bukan dari sinyal teks internal. Penyedianya mencantumkan bahasa Indonesia, tetapi ketepatannya belum kami ukur sendiri, jadi angkanya tetap bahan tinjau, bukan kesimpulan. Nama penyedia dan versi modelnya tercatat di panel Asal Skor AI.",
    tone: "neutral",
  },
  heuristic: {
    label: "Analisis cadangan",
    hint: "Model bahasa tidak tersedia. Angka dihitung dari sinyal teks sederhana dan hanya layak dipakai sebagai indikasi kasar.",
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
  if (!copy || source === "llm") return null;
  return <p className="text-body-sm text-muted-foreground">{copy.hint}</p>;
}
