import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  caption: string;
  action?: ReactNode;
  /** `inline` tanpa kartu, untuk slot kosong di dalam kartu lain (daftar, tab). */
  variant?: "card" | "inline";
}

/** Slot kosong yang mengajak bertindak: judul, penjelasan, dan (opsional) tombol. */
export function EmptyState({ title, caption, action, variant = "card" }: EmptyStateProps) {
  if (variant === "inline") {
    return (
      <div className="px-5 py-10 text-center">
        <h3 className="font-bold text-foreground">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{caption}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    );
  }
  return (
    <Card variant="dashed" className="px-8 py-12 text-center">
      <h2 className="mb-2 font-display text-heading font-medium text-foreground">{title}</h2>
      <p className="mx-auto max-w-md text-body text-muted-foreground">{caption}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  );
}
