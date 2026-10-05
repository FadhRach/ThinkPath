"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Brandmark } from "@/components/common/Brandmark";
import { NotificationBell } from "@/components/common/NotificationBell";
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
    { label: "Dashboard", href: "/dashboard" },
    { label: "Kelas", href: "/dashboard/classes" },
    { label: "Tugas", href: "/dashboard/tugas" },
    { label: "Pengumpulan", href: "/dashboard/pengumpulan" },
    { label: "Verifikasi", href: "/dashboard/verifikasi" },
    { label: "Laporan", href: "/dashboard/laporan" },
  ],
  student: [
    { label: "Beranda", href: "/student" },
    { label: "Kelas", href: "/student/kelas" },
    { label: "Tugas", href: "/student/tugas" },
    { label: "Materi", href: "/student/materi" },
    { label: "Jadwal", href: "/student/jadwal" },
    { label: "Progres", href: "/student/progress" },
  ],
};

interface Props {
  role: Role;
  /** Chip pengguna (server component yang di-stream), dirender apa adanya. */
  userMenu: React.ReactNode;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/student") return pathname === href;
  if (href === "/student/tugas" && pathname.startsWith("/student/submit/")) return true;
  if (href === "/dashboard/pengumpulan" && pathname.startsWith("/dashboard/submission/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ role, userMenu }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV_ITEMS[role];
  const homeHref = role === "teacher" ? "/dashboard" : "/student";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-5 sm:px-8 lg:px-10">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            aria-label="Buka menu"
            className={cn("grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted", role === "teacher" ? "xl:hidden" : "lg:hidden")}
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className={cn("w-72", role === "teacher" ? "teacher-theme" : "student-theme")}>
            <SheetTitle className="sr-only">Navigasi</SheetTitle>
            <div className="mb-6 mt-1">
              <Brandmark />
            </div>
            <nav className="flex flex-col gap-1">
              {items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} block onClick={() => setMenuOpen(false)} />
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href={homeHref} className="shrink-0">
          <Brandmark />
        </Link>

        <nav aria-label={role === "teacher" ? "Navigasi dosen" : "Navigasi mahasiswa"} className={cn("hidden flex-1 items-center gap-1", role === "teacher" ? "xl:flex" : "lg:flex")}>
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
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
