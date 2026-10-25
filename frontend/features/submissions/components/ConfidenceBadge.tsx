import { Badge } from "@/components/ui/badge";
import type { Confidence } from "@/lib/types";

const CONFIDENCE_LABELS: Record<Exclude<Confidence, "">, string> = {
  low: "Keyakinan rendah",
  medium: "Keyakinan sedang",
  high: "Keyakinan tinggi",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  if (confidence === "") return null;
  return <Badge tone="neutral">{CONFIDENCE_LABELS[confidence]}</Badge>;
}
