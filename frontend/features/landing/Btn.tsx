import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Variant = "primary" | "outline" | "ghost";

/**
 * Tombol landing: pembungkus tipis atas Button bersama (tautan #jangkar dan mailto: memakai
 * <a>, rute aplikasi memakai Link). Landing besar (lg) kecuali di navigasi (`small`).
 */
export function Btn({
  href,
  variant = "primary",
  small,
  block,
  children,
}: {
  href: string;
  variant?: Variant;
  small?: boolean;
  block?: boolean;
  children: ReactNode;
}) {
  const external = href.startsWith("#") || href.startsWith("mailto:");
  return (
    <Button
      asChild
      variant={variant === "primary" ? "default" : variant}
      size={small ? "default" : "lg"}
      className={block ? "w-full" : undefined}
    >
      {external ? <a href={href}>{children}</a> : <Link href={href}>{children}</Link>}
    </Button>
  );
}
