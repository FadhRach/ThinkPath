import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { formatClockHHMM } from "@/lib/formatting";
import { AGENDA_STYLE, agendaState } from "@/lib/schedule";
import type { ScheduleItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  item: ScheduleItem;
  /** Saat halaman dirender; menentukan tenggat mana yang sudah terlewat. */
  now?: Date;
  /** Versi rapat untuk kartu di beranda. */
  compact?: boolean;
}

/**
 * Satu baris agenda: jam, garis warna status, judul, lalu kelas dan status.
 * Status ditulis sebaris dengan nama kelas, bukan sebagai lencana di kanan,
 * supaya baris tetap terbaca di panel sempit dan di ponsel.
 */
export function AgendaRow({ item, now = new Date(), compact = false }: Props) {
  const style = AGENDA_STYLE[agendaState(item, now)];

  return (
    <Link
      href={item.link}
      className={cn(
        "flex items-center gap-3 transition hover:bg-muted/40",
        compact ? "rounded-lg px-2 py-2" : "px-4 py-3",
      )}
    >
      <div className="w-12 shrink-0 text-center">
        <p className="font-bold tabular-nums text-foreground">{formatClockHHMM(item.at)}</p>
        <p className="text-caption text-muted-foreground">
          {item.kind === "session" ? "Sesi" : "Tenggat"}
        </p>
      </div>
      <span aria-hidden="true" className={cn("w-1 self-stretch rounded-full", style.mark)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-semibold text-foreground">{item.title}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-caption">
          <span className="truncate text-muted-foreground">{item.class_name}</span>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <span className={cn("shrink-0 font-semibold", style.text)}>{style.label}</span>
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
