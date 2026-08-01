import {
  AlertTriangle,
  Info,
  Lightbulb,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type CalloutVariant = "info" | "warning" | "danger" | "success";

interface VariantStyle {
  container: string;
  icon: string;
  title: string;
  defaultIcon: LucideIcon;
}

const VARIANTS: Record<CalloutVariant, VariantStyle> = {
  info: {
    container: "border-brand-mint bg-secondary/40",
    icon: "text-primary",
    title: "text-foreground",
    defaultIcon: Info,
  },
  success: {
    container: "border-success/30 bg-success-soft",
    icon: "text-success",
    title: "text-foreground",
    defaultIcon: ShieldCheck,
  },
  warning: {
    container: "border-warning/30 bg-warning-soft",
    icon: "text-warning",
    title: "text-foreground",
    defaultIcon: Lightbulb,
  },
  danger: {
    container: "border-danger/30 bg-danger-soft",
    icon: "text-danger",
    title: "text-foreground",
    defaultIcon: AlertTriangle,
  },
};

interface Props {
  variant?: CalloutVariant;
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function Callout({ variant = "info", title, icon, children, className }: Props) {
  const style = VARIANTS[variant];
  const Icon = icon ?? style.defaultIcon;
  return (
    <div className={cn("rounded-2xl border p-4", style.container, className)}>
      {title ? (
        <div className="mb-2 flex items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", style.icon)} />
          <p className={cn("text-body font-bold", style.title)}>{title}</p>
        </div>
      ) : null}
      <div className="text-body-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
