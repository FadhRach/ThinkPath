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
}

const ICON_TONE: Record<NonNullable<Props["tone"]>, string> = {
  brand: "bg-secondary text-primary",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "brand" }: Props) {
  return (
    <Card className="flex items-start gap-3 p-4 shadow-soft">
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
