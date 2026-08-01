import type { Confidence } from "@/lib/types";

const CONFIDENCE_LABELS: Record<Exclude<Confidence, "">, string> = {
  low: "Keyakinan rendah",
  medium: "Keyakinan sedang",
  high: "Keyakinan tinggi",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  if (confidence === "") return null;
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-body-sm font-medium text-muted-foreground">
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}
