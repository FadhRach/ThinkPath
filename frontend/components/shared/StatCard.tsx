import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  /** Nada ikon; `danger` untuk metrik yang perlu perhatian. */
  tone?: "brand" | "danger" | "warning";
  /** Ikon di atas angka pada layar sempit (grid dua kolom di ponsel). */
  stackOnMobile?: boolean;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
  stackOnMobile = false,
}: StatCardProps) {
  return (
    <Card className={cn("flex items-start gap-3 p-4", stackOnMobile && "flex-col sm:flex-row")}>
      {icon ? <IconTile icon={icon} tone={tone} /> : null}
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
