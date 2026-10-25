import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

interface BreadcrumbItem {
  label: string;
  /** Kosong untuk halaman saat ini. */
  href?: string;
}

/** Jejak navigasi. Butir terakhir adalah halaman saat ini dan tidak berupa tautan. */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Lokasi halaman"
      className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"
    >
      {items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
          {item.href ? (
            <Link href={item.href} className="max-w-[10rem] truncate hover:text-brand-ink">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="truncate text-foreground">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
