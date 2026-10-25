import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

/** Tombol ikon di toolbar editor. `aria-pressed` menandai format yang sedang aktif. */
export function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Mouse down tidak boleh mencuri fokus dari editor, atau seleksi teks hilang.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "h-8 w-8 shrink-0 text-muted-foreground",
        active && "bg-secondary text-secondary-foreground hover:bg-secondary",
      )}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
