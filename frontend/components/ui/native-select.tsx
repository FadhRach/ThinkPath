import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * <select> bawaan peramban dengan gaya yang sama dengan Input. Dipakai untuk pilihan
 * pendek di form biasa; `Select` (Radix) hanya untuk dropdown yang butuh tampilan khusus.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
