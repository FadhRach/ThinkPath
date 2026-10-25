"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavActive, type NavItem } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  items: NavItem[];
  /** Hanya ikon: label disembunyikan secara visual tetapi tetap terbaca pembaca layar. */
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** Daftar menu sidebar. Dipakai sidebar desktop dan laci di ponsel. */
export function SidebarNav({ items, collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isNavActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center px-0",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {Icon ? (
              <Icon
                aria-hidden="true"
                className={cn("h-5 w-5 shrink-0", active ? "text-brand-ink" : "")}
              />
            ) : null}
            <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
