import type { AnalysisSource } from "@/lib/types";

/**
 * Menandai mesin yang menghasilkan satu hasil analisis.
 *
 * Tanpa penanda ini, hasil heuristik dangkal tampil identik dengan hasil LLM di
 * layar guru. Guru berhak tahu bahwa angka yang sedang dilihatnya berasal dari
 * hitungan cadangan, bukan dari analisis penuh.
 */
const SOURCE_COPY: Record<AnalysisSource, { label: string; hint: string; tone: string }> = {
  llm: {
    label: "Analisis penuh",
    hint: "Dihitung oleh model bahasa.",
    tone: "bg-muted text-muted-foreground",
  },
  heuristic: {
    label: "Analisis cadangan",
    hint: "Model bahasa tidak tersedia. Angka dihitung dari sinyal teks sederhana dan hanya layak dipakai sebagai indikasi kasar.",
    tone: "bg-warning-soft text-warning",
  },
  seed: {
    label: "Data demo",
    hint: "Baris ini berasal dari data contoh, bukan pengerjaan siswa sungguhan.",
    tone: "bg-accent text-accent-foreground",
  },
};

export function AnalysisSourceBadge({ source }: { source: AnalysisSource }) {
  const copy = SOURCE_COPY[source];
  if (!copy) return null;
  return (
    <span
      title={copy.hint}
      className={`inline-flex items-center rounded-full px-3 py-1 text-body-sm font-medium ${copy.tone}`}
    >
      {copy.label}
    </span>
  );
}

export function AnalysisSourceNote({ source }: { source: AnalysisSource }) {
  const copy = SOURCE_COPY[source];
  if (!copy || source === "llm") return null;
  return <p className="text-body-sm text-muted-foreground">{copy.hint}</p>;
}
