import { Search, type LucideIcon } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface IconInputProps extends React.ComponentProps<"input"> {
  icon: LucideIcon;
  /** Elemen di ujung kanan (mis. tombol tampilkan kata sandi). */
  trailing?: React.ReactNode;
}

/** Input dengan ikon di kiri. Ikon berwarna aksen, bukan abu-abu polos. */
export const IconInput = React.forwardRef<HTMLInputElement, IconInputProps>(
  ({ icon: Icon, trailing, className, ...props }, ref) => (
    <div className="relative">
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink"
      />
      <Input ref={ref} className={cn("pl-10", trailing ? "pr-10" : "", className)} {...props} />
      {trailing ? (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>
      ) : null}
    </div>
  ),
);
IconInput.displayName = "IconInput";

/** Kolom pencarian standar. */
export const SearchInput = React.forwardRef<HTMLInputElement, Omit<IconInputProps, "icon">>(
  (props, ref) => <IconInput ref={ref} icon={Search} type="search" {...props} />,
);
SearchInput.displayName = "SearchInput";
