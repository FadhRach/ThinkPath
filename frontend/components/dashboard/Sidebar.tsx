"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "./LogoutButton";

const NAV_ITEMS = [
  { label: "Kelas", href: "/dashboard" },
  { label: "Tugas", href: "/dashboard?tab=tugas" },
  { label: "Review", href: "/dashboard?tab=review" },
] as const;

interface Props {
  displayName: string;
  email: string;
}

export function Sidebar({ displayName, email }: Props) {
  const pathname = usePathname();
  return (
    <aside className="w-[240px] shrink-0 border-r border-border bg-paper flex flex-col h-screen sticky top-0">
      <div className="px-6 py-7">
        <p className="font-display text-2xl tracking-tight">ThinkPath</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === pathname;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={
                "block rounded-card px-3 py-2 text-body border-l-2 " +
                (isActive
                  ? "bg-accent-soft text-accent border-accent"
                  : "border-transparent text-ink hover:bg-accent-soft/50")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-5 border-t border-border space-y-2">
        <p className="text-body-sm text-ink">{displayName || email}</p>
        <p className="text-body-sm text-ink-muted truncate">{email}</p>
        <LogoutButton />
      </div>
    </aside>
  );
}
