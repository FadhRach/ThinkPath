import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const TONES = {
  brand: "bg-secondary text-brand-ink",
  solid: "bg-primary text-primary-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-muted text-muted-foreground",
} as const;

const SIZES = {
  sm: { box: "h-8 w-8 rounded-lg", icon: "h-4 w-4" },
  md: { box: "h-10 w-10 rounded-xl", icon: "h-5 w-5" },
  lg: { box: "h-12 w-12 rounded-xl", icon: "h-6 w-6" },
} as const;

interface IconTileProps {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Ikon di dalam kotak berwarna. Ikon polos tanpa latar tidak dipakai di UI utama. */
export function IconTile({ icon: Icon, tone = "brand", size = "md", className }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center", SIZES[size].box, TONES[tone], className)}
    >
      <Icon className={SIZES[size].icon} />
    </span>
  );
}
