"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Wadah toast untuk seluruh aplikasi, dipasang sekali di app/layout.tsx.
 * Kirim toast lewat `notify` (lib/notify.ts), bukan memanggil sonner langsung.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-xl border border-border bg-card text-foreground shadow-soft-lg",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
    />
  );
}
