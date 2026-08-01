import { bloomCode, bloomShortLabel } from "@/lib/bloom";
import { cn } from "@/lib/utils";

interface Props {
  level: number;
  // "code" hanya "L4"; "full" jadi "L4 Menganalisis".
  variant?: "code" | "full";
  className?: string;
}

export function BloomBadge({ level, variant = "full", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground",
        className,
      )}
    >
      {variant === "code" ? bloomCode(level) : `${bloomCode(level)} ${bloomShortLabel(level)}`}
    </span>
  );
}
