"use client";

import { Bell, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brandmark } from "@/components/common/Brandmark";
import { NavSearch } from "@/components/common/NavSearch";
import { NavUser } from "@/components/common/NavUser";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  // Halaman yang belum dibangun ditandai agar tidak menyesatkan pengguna.
  disabled?: boolean;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  teacher: [
    { label: "Overview", href: "/dashboard" },
    { label: "Kelas", href: "/dashboard/classes", disabled: true },
    { label: "Tugas", href: "/dashboard/tugas", disabled: true },
    { label: "Verifikasi", href: "/dashboard/verifikasi", disabled: true },
    { label: "Laporan", href: "/dashboard/laporan", disabled: true },
  ],
  student: [
    { label: "Beranda", href: "/student" },
    { label: "Tugas", href: "/student/tugas", disabled: true },
    { label: "Materi", href: "/student/materi", disabled: true },
    { label: "Jadwal", href: "/student/jadwal", disabled: true },
    { label: "Progres", href: "/student/progres", disabled: true },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  teacher: "Dosen",
  student: "Mahasiswa",
};

interface Props {
  role: Role;
  displayName: string;
  email: string;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/student") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ role, displayName, email }: Props) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role];
  const homeHref = role === "teacher" ? "/dashboard" : "/student";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:px-6">
        <Sheet>
          <SheetTrigger
            aria-label="Buka menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
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
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} block />
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href={homeHref} className="shrink-0">
          <Brandmark />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <NavSearch />
          <button
            type="button"
            aria-label="Notifikasi"
            className="relative grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-muted"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-danger" />
          </button>
          <NavUser
            displayName={displayName}
            email={email}
            roleLabel={ROLE_LABEL[role]}
          />
        </div>
      </div>
    </header>
  );
}

interface NavLinkProps {
  item: NavItem;
  active: boolean;
  block?: boolean;
}

function NavLink({ item, active, block }: NavLinkProps) {
  const base = cn(
    "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
    block && "w-full",
  );

  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        title="Segera hadir"
        className={cn(base, "cursor-not-allowed text-muted-foreground/50")}
      >
        {item.label}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        base,
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {item.label}
    </Link>
  );
}
