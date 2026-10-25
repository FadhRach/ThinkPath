import { ChartColumn, ClipboardList, LibraryBig, MessagesSquare, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { tabLinkClass } from "@/components/ui/tab-styles";

export type ClassSection = "analitik" | "mahasiswa" | "tugas" | "materi" | "forum";
const TABS = [
  { id: "analitik", label: "Analitik", icon: ChartColumn },
  { id: "mahasiswa", label: "Mahasiswa", icon: Users },
  { id: "tugas", label: "Tugas", icon: ClipboardList },
  { id: "materi", label: "Materi", icon: LibraryBig },
  { id: "forum", label: "Forum", icon: MessagesSquare },
] as const;

export function ClassSectionTabs({
  classId,
  active,
  counts,
}: {
  classId: string;
  active: ClassSection;
  /** Jumlah isi per bagian; Analitik tidak punya hitungan. */
  counts: Record<Exclude<ClassSection, "analitik">, number>;
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
          {id === "analitik" ? null : (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-micro",
                active === id ? "bg-white/15" : "bg-muted",
              )}
            >
              {counts[id]}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
