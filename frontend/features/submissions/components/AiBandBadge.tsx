import { Badge } from "@/components/ui/badge";
import { aiBandLabel, aiBandTone } from "@/features/submissions/lib/status";
import type { AiBand } from "@/lib/types";

interface AiBandBadgeProps {
  band: AiBand;
  /** Teks tambahan setelah label, mis. skor. */
  suffix?: string;
  size?: "sm" | "md";
  className?: string;
}

/** Lencana indikasi AI (rendah/sedang/tinggi). Satu tempat untuk warna dan label band. */
export function AiBandBadge({ band, suffix, size = "sm", className }: AiBandBadgeProps) {
  return (
    <Badge tone={aiBandTone(band)} size={size} className={className}>
      {aiBandLabel(band)}
      {suffix ? ` · ${suffix}` : ""}
    </Badge>
  );
}
