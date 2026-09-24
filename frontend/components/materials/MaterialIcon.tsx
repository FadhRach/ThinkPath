import {
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Globe,
  HardDrive,
  NotebookText,
  PlayCircle,
  Presentation,
  type LucideIcon,
} from "lucide-react";

import type { MaterialSource } from "@/lib/materials";
import { cn } from "@/lib/utils";

const ICONS: Record<MaterialSource, { icon: LucideIcon; tone: string }> = {
  slides: { icon: Presentation, tone: "bg-warning-soft text-warning" },
  docs: { icon: FileText, tone: "bg-secondary text-primary" },
  sheets: { icon: FileSpreadsheet, tone: "bg-success-soft text-success" },
  forms: { icon: ClipboardList, tone: "bg-accent text-accent-foreground" },
  drive: { icon: HardDrive, tone: "bg-secondary text-primary" },
  video: { icon: PlayCircle, tone: "bg-danger-soft text-danger" },
  pdf: { icon: FileText, tone: "bg-danger-soft text-danger" },
  web: { icon: Globe, tone: "bg-muted text-foreground/70" },
  note: { icon: NotebookText, tone: "bg-accent text-accent-foreground" },
};

/** Ikon menurut jenis sumber, supaya slide, video, dan bacaan terbedakan sekilas. */
export function MaterialIcon({ kind, className }: { kind: MaterialSource; className?: string }) {
  const { icon: Icon, tone } = ICONS[kind];
  return (
    <span
      aria-hidden="true"
      className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone, className)}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}
