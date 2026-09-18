import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  // Nada aksen ikon; default teal, "danger" untuk metrik yang perlu perhatian.
  tone?: "brand" | "danger" | "warning";
  /** Ikon di atas angka pada layar sempit. Untuk grid dua kolom di ponsel,
   *  tempat ikon di samping teks membuat label terlipat berantakan. */
  stackOnMobile?: boolean;
}

const ICON_TONE: Record<NonNullable<Props["tone"]>, string> = {
  brand: "bg-secondary text-primary",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  stackOnMobile = false,
}: Props) {
  return (
    <Card
      className={cn(
        "flex items-start gap-3 p-4 shadow-soft",
        stackOnMobile && "flex-col sm:flex-row",
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            ICON_TONE[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <div className="min-w-0 space-y-0.5">
        <p className="text-body-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-extrabold leading-tight tracking-tight text-foreground">
          {value}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </Card>
  );
}
