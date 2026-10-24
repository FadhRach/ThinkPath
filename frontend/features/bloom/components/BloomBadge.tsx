import { Badge } from "@/components/ui/badge";
import { bloomCode, bloomShortLabel } from "@/features/bloom/lib/bloom";

interface BloomBadgeProps {
  level: number;
  /** "code" hanya "L4"; "full" jadi "L4 Menganalisis". */
  variant?: "code" | "full";
  className?: string;
}

export function BloomBadge({ level, variant = "full", className }: BloomBadgeProps) {
  return (
    <Badge tone="brand" className={className}>
      {variant === "code" ? bloomCode(level) : `${bloomCode(level)} ${bloomShortLabel(level)}`}
    </Badge>
  );
}
