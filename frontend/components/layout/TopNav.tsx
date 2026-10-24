"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Brandmark } from "@/components/layout/Brandmark";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isNavActive, NAV_BY_ROLE, type NavItem } from "@/components/layout/nav-config";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  role: Role;
  /** Chip pengguna (server component yang di-stream), dirender apa adanya. */
  userMenu: React.ReactNode;
}

export function TopNav({ role, userMenu }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV_BY_ROLE[role];
  const homeHref = role === "teacher" ? "/dashboard" : "/student";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-5 sm:px-8 lg:px-10">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            aria-label="Buka menu"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted",
              role === "teacher" ? "xl:hidden" : "lg:hidden",
            )}
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetTitle className="sr-only">Navigasi</SheetTitle>
            <div className="mb-6 mt-1">
              <Brandmark />
            </div>
            <nav className="flex flex-col gap-1">
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isNavActive(pathname, item)}
                  block
                  onClick={() => setMenuOpen(false)}
                />
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href={homeHref} className="shrink-0">
          <Brandmark />
        </Link>

        <nav
          aria-label={role === "teacher" ? "Navigasi dosen" : "Navigasi mahasiswa"}
          className={cn(
            "hidden flex-1 items-center gap-1",
            role === "teacher" ? "xl:flex" : "lg:flex",
          )}
        >
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={isNavActive(pathname, item)} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <NotificationBell />
          {userMenu}
        </div>
      </div>
    </header>
  );
}

interface NavLinkProps {
  item: NavItem;
  active: boolean;
  block?: boolean;
  onClick?: () => void;
}

function NavLink({ item, active, block, onClick }: NavLinkProps) {
  const base = cn(
    "border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors",
    block && "w-full",
  );

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        base,
        active
          ? "border-primary text-foreground"
          : "text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {item.label}
    </Link>
  );
}
