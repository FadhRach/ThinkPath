import { BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";

interface ClassChipProps {
  name: string;
  className?: string;
}

/** Ikon buku dan nama kelas, supaya jelas tugas ini milik kelas yang mana. */
export function ClassChip({ name, className }: ClassChipProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0 text-brand-ink" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}
