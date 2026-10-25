import { AlertTriangle, CheckCircle2, Info, Lightbulb, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type AlertVariant = "info" | "success" | "warning" | "danger";

const VARIANTS: Record<AlertVariant, { container: string; icon: string; defaultIcon: LucideIcon }> =
  {
    info: {
      container: "border-brand-mint bg-secondary/40",
      icon: "text-brand-ink",
      defaultIcon: Info,
    },
    success: {
      container: "border-success/30 bg-success-soft",
      icon: "text-success",
      defaultIcon: CheckCircle2,
    },
    warning: {
      container: "border-warning/30 bg-warning-soft",
      icon: "text-warning",
      defaultIcon: Lightbulb,
    },
    danger: {
      container: "border-danger/30 bg-danger-soft",
      icon: "text-danger",
      defaultIcon: AlertTriangle,
    },
  };

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}

/**
 * Pesan bawaan halaman (bukan toast): catatan, peringatan, dan galat yang
 * harus tetap terlihat. Galat memakai role="alert" agar dibacakan pembaca layar.
 */
export function Alert({ variant = "info", title, icon, className, children }: AlertProps) {
  const style = VARIANTS[variant];
  const Icon = icon ?? style.defaultIcon;
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border p-4", style.container, className)}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", style.icon)} />
      <div className="min-w-0 space-y-1">
        {title ? <p className="text-body font-bold text-foreground">{title}</p> : null}
        <div className="text-body-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
