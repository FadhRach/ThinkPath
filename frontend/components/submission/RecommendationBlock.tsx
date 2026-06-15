interface Props {
  recommendation: string | null;
  expectedBloomLevel: number;
  observedBloomLevel: number | null;
}

const BLOOM_LABELS: Record<number, string> = {
  1: "Mengingat",
  2: "Memahami",
  3: "Mengaplikasikan",
  4: "Menganalisis",
  5: "Mengevaluasi",
  6: "Mencipta",
};

export function RecommendationBlock({
  recommendation,
  expectedBloomLevel,
  observedBloomLevel,
}: Props) {
  const expectedLabel = BLOOM_LABELS[expectedBloomLevel] ?? `Level ${expectedBloomLevel}`;
  const observedLabel = observedBloomLevel
    ? `${BLOOM_LABELS[observedBloomLevel] ?? "tidak diketahui"} (level ${observedBloomLevel})`
    : "belum tersedia";

  return (
    <div className="border border-border rounded-card p-4 bg-paper">
      <p className="caption-eyebrow mb-2">Rekomendasi</p>
      <p className="text-body text-ink leading-relaxed">
        {recommendation ||
          "Belum ada rekomendasi otomatis. Tinjau bukti di atas untuk menentukan tindak lanjut."}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-body-sm">
        <div>
          <dt className="caption-eyebrow">Target Bloom</dt>
          <dd className="text-ink mt-1">{expectedLabel} (level {expectedBloomLevel})</dd>
        </div>
        <div>
          <dt className="caption-eyebrow">Teramati</dt>
          <dd className="text-ink mt-1">{observedLabel}</dd>
        </div>
      </dl>
    </div>
  );
}
