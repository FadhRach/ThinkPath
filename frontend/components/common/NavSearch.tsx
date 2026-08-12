import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  placeholder?: string;
  className?: string;
}

// Kolom pencarian pada navbar. Belum ada endpoint pencarian global, jadi
// input-nya DINONAKTIFKAN, bukan sekadar tidak diproses. Input yang menerima
// ketikan lalu tidak melakukan apa pun lebih menyesatkan daripada input yang
// jelas terlihat belum aktif.
export function NavSearch({ placeholder = "Cari tugas atau materi...", className }: Props) {
  return (
    <div
      className={cn(
        "hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground/50 md:flex",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <input
        type="search"
        placeholder={placeholder}
        aria-label="Cari"
        disabled
        title="Pencarian segera hadir"
        className="w-56 cursor-not-allowed bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
