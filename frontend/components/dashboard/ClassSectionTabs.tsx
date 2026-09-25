import Link from "next/link";

import { cn } from "@/lib/utils";

export type ClassSection = "tugas" | "materi";

interface Props {
  classId: string;
  active: ClassSection;
  counts: Record<ClassSection, number>;
}

/**
 * Tab bagian kelas sebagai tautan biasa, bukan state klien, supaya tab yang
 * sedang dibuka ikut tersimpan di URL dan tetap sama setelah halaman dimuat
 * ulang atau tautannya dibagikan, sama seperti pilihan tugas lewat ?assignment=.
 */
export function ClassSectionTabs({ classId, active, counts }: Props) {
  const tabs: Array<{ id: ClassSection; label: string; href: string }> = [
    { id: "tugas", label: "Tugas", href: `/dashboard/classes/${classId}` },
    { id: "materi", label: "Materi", href: `/dashboard/classes/${classId}?tab=materi` },
  ];

  return (
    <nav
      aria-label="Bagian kelas"
      className="inline-flex gap-1 rounded-xl border border-border bg-card p-1 shadow-soft"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-body-sm font-medium transition",
              isActive
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-caption tabular-nums",
                isActive ? "bg-card/70" : "bg-muted",
              )}
            >
              {counts[tab.id]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
