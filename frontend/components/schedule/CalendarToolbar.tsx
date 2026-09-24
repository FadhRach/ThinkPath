import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { ClassFilter } from "@/components/schedule/ClassFilter";
import {
  ALL_CLASSES,
  jadwalHref,
  type CalendarRange,
  type CalendarView,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

interface Props {
  range: CalendarRange;
  classes: Array<{ id: string; name: string }>;
  selectedClass: string | null;
}

const VIEWS: Array<{ id: CalendarView; label: string }> = [
  { id: "bulan", label: "Bulan" },
  { id: "minggu", label: "Minggu" },
];

/**
 * Navigasi kalender sebagai tautan biasa: tampilan, tanggal, dan saringan
 * kelas tersimpan di alamat halaman, jadi tetap sama setelah dimuat ulang
 * dan bisa dibuka langsung dari notifikasi.
 */
export function CalendarToolbar({ range, classes, selectedClass }: Props) {
  const unit = range.view === "bulan" ? "Bulan" : "Pekan";
  const hrefFor = (overrides: { view?: CalendarView; date?: string | null; kelas?: string | null }) =>
    jadwalHref({
      view: overrides.view ?? range.view,
      date: overrides.date === undefined ? range.anchor : overrides.date,
      kelas: overrides.kelas === undefined ? selectedClass : overrides.kelas,
    });

  const classHrefs: Record<string, string> = {
    [ALL_CLASSES]: hrefFor({ kelas: null }),
  };
  for (const cls of classes) classHrefs[cls.id] = hrefFor({ kelas: cls.id });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={hrefFor({ date: null })}
          className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-border bg-card px-3.5 text-body-sm font-semibold text-foreground shadow-soft transition hover:border-primary/50 hover:text-primary"
        >
          Hari ini
        </Link>
        <div className="flex shrink-0 items-center">
          <Link
            href={hrefFor({ date: range.previous })}
            aria-label={`${unit} sebelumnya`}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Link
            href={hrefFor({ date: range.next })}
            aria-label={`${unit} berikutnya`}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
        <h2 className="min-w-0 truncate text-lg font-bold text-foreground">
          <span className="sm:hidden">{range.shortLabel}</span>
          <span className="hidden sm:inline">{range.label}</span>
        </h2>
      </div>

      <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
        {classes.length > 1 ? (
          <div className="min-w-0 flex-1 sm:flex-none">
            <ClassFilter classes={classes} selected={selectedClass} hrefs={classHrefs} />
          </div>
        ) : null}
        <nav
          aria-label="Tampilan kalender"
          className="inline-flex shrink-0 gap-1 rounded-xl border border-border bg-card p-1 shadow-soft"
        >
          {VIEWS.map((view) => {
            const active = view.id === range.view;
            return (
              <Link
                key={view.id}
                href={hrefFor({ view: view.id })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1 text-body-sm font-medium transition",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
