import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { AnalysisSource } from "@/lib/types";

// Asal SKOR AI saja; level Bloom bisa dari mesin lain pada jawaban yang sama.
const SOURCE_COPY: Record<AnalysisSource, { label: string; hint: string; tone: BadgeTone }> = {
  detector: {
    label: "Winston AI",
    hint: "Skor AI dari detektor Winston AI.",
    tone: "neutral",
  },
  heuristic: {
    label: "Heuristik",
    hint: "Skor AI dari heuristik ThinkPath.",
    tone: "warning",
  },
  seed: {
    label: "Data demo",
    hint: "Skor AI dari heuristik ThinkPath (data contoh).",
    tone: "info",
  },
  // Hanya ada pada hasil lama, sebelum Groq berhenti memberi skor AI.
  llm: {
    label: "Model bahasa (lama)",
    hint: "Hasil versi lama. Tekan Analisis Ulang untuk menghitung ulang.",
    tone: "warning",
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
