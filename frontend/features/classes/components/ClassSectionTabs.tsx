import { ClipboardList, LibraryBig, Megaphone, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { tabLinkClass } from "@/components/ui/tab-styles";

export type ClassSection = "mahasiswa" | "materi" | "pengumuman" | "tugas";
const TABS = [
  { id: "mahasiswa", label: "Mahasiswa", icon: Users },
  { id: "materi", label: "Materi", icon: LibraryBig },
  { id: "pengumuman", label: "Pengumuman", icon: Megaphone },
  { id: "tugas", label: "Tugas", icon: ClipboardList },
] as const;

export function ClassSectionTabs({
  classId,
  active,
  counts,
}: {
  classId: string;
  active: ClassSection;
  counts: Record<ClassSection, number>;
}) {
  return (
    <nav
      aria-label="Bagian kelas"
      className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-sm"
    >
      {TABS.map(({ id, label, icon: Icon }) => (
        <Link
          key={id}
          href={`/dashboard/classes/${classId}?tab=${id}`}
          aria-current={active === id ? "page" : undefined}
          className={tabLinkClass(active === id)}
        >
          <Icon className="h-4 w-4" />
          {label}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-micro",
              active === id ? "bg-white/15" : "bg-muted",
            )}
          >
            {counts[id]}
          </span>
        </Link>
      ))}
    </nav>
  );
}
