"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Brandmark } from "@/components/layout/Brandmark";
import { Footer } from "@/components/layout/Footer";
import { NAV_BY_ROLE, navTitle } from "@/components/layout/nav-config";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const HOME: Record<Role, string> = { teacher: "/dashboard", student: "/student" };

interface SidebarShellProps {
  /**
   * Peran menentukan menu. Menu dicari di sini (di sisi klien), bukan dikirim sebagai prop dari
   * server component: ikon di dalamnya adalah komponen, dan komponen tidak bisa diserialisasi.
   */
  role: Role;
  /** Chip pengguna, di-stream dari layout lewat Suspense. */
  userMenu: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Kerangka mahasiswa dan dosen: sidebar kiri yang bisa dilipat (desktop), laci menu (ponsel),
 * dan topbar tipis untuk judul halaman, notifikasi, dan profil.
 *
 * Status lipat hanya disimpan di memori halaman. Menyimpannya ke cookie atau
 * localStorage bertentangan dengan Kebijakan Privasi (tanpa penyimpanan peramban).
 */
export function SidebarShell({ role, userMenu, children }: SidebarShellProps) {
  const items = NAV_BY_ROLE[role];
  const homeHref = HOME[role];
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card transition-[width] duration-300 ease-out lg:flex",
          collapsed ? "w-[4.75rem]" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center gap-2 border-b border-border px-4",
            collapsed ? "justify-center px-0" : "justify-between",
          )}
        >
          {collapsed ? null : (
            <Link
              href={homeHref}
              aria-label="ThinkPath, ke Beranda"
              className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Brandmark />
            </Link>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Perluas sidebar" : "Lipat sidebar"}
            aria-pressed={collapsed}
            title={collapsed ? "Perluas sidebar" : "Lipat sidebar"}
            className="shrink-0 text-muted-foreground"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav items={items} collapsed={collapsed} />
        </div>
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 p-0 lg:hidden">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 items-center border-b border-border px-5">
            <Brandmark />
          </div>
          <div className="px-3 py-4">
            <SidebarNav items={items} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-300 ease-out",
          collapsed ? "lg:pl-[4.75rem]" : "lg:pl-64",
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Buka menu"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu />
          </Button>
          <Link href={homeHref} className="lg:hidden" aria-label="ThinkPath, ke Beranda">
            <Brandmark showWordmark={false} />
          </Link>
          <h2 className="truncate text-base font-bold tracking-tight sm:text-lg">
            {navTitle(pathname, items)}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            {userMenu}
          </div>
        </header>
        <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
