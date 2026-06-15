import type { AiBand } from "@/lib/types";

const BAND_COLOR: Record<AiBand, string> = {
  low: "bg-signal-low",
  mid: "bg-signal-mid",
  high: "bg-signal-high",
};

interface Props {
  processBand: AiBand;
  textBand: AiBand;
  cognitiveBand: AiBand;
}

export function EvidenceStripMini({ processBand, textBand, cognitiveBand }: Props) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Evidence strip">
      <span className={`block w-2 h-2 rounded-full ${BAND_COLOR[processBand]}`} title="Proses" />
      <span className={`block w-2 h-2 rounded-full ${BAND_COLOR[textBand]}`} title="Teks" />
      <span className={`block w-2 h-2 rounded-full ${BAND_COLOR[cognitiveBand]}`} title="Kognitif" />
    </div>
  );
}
