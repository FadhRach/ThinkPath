import { Hourglass, MessagesSquare } from "lucide-react";
import Link from "next/link";

import { formatClockHHMM } from "@/lib/formatting";
import { AGENDA_STYLE, agendaState, shortTitle } from "@/lib/schedule";
import type { ScheduleItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  item: ScheduleItem;
  now: Date;
  /** "month": satu baris di kotak tanggal. "week": kartu lengkap di kolom hari. */
  variant: "month" | "week";
}

export function EventChip({ item, now, variant }: Props) {
  const style = AGENDA_STYLE[agendaState(item, now)];
  const time = formatClockHHMM(item.at);
  const title = shortTitle(item);
  const kind = item.kind === "session" ? "Sesi diskusi jawaban" : "Tenggat";
  const summary = `${kind} pukul ${time}: ${title}. ${item.class_name}. ${style.label}.`;
  const Icon = item.kind === "session" ? MessagesSquare : Hourglass;

  if (variant === "month") {
    // Jam hanya untuk sesi, yang memang janji temu. Tenggat hampir selalu
    // 23.59, jadi jamnya cuma memakan tempat judul di kotak yang sempit;
    // jam lengkapnya tetap ada di daftar agenda dan di tooltip.
    return (
      <Link
        href={item.link}
        title={summary}
        aria-label={summary}
        className={cn(
          "flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium leading-4 transition hover:brightness-95",
          style.chip,
        )}
      >
        {item.kind === "session" ? (
          <>
            <MessagesSquare aria-hidden="true" className="h-3 w-3 shrink-0" />
            <span className="shrink-0 tabular-nums opacity-80">{time}</span>
          </>
        ) : (
          <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.mark)} />
        )}
        <span className="truncate">{title}</span>
      </Link>
    );
  }

  return (
    <Link
      href={item.link}
      aria-label={summary}
      className={cn("block rounded-lg px-2.5 py-2 transition hover:brightness-95", style.chip)}
    >
      <span className="flex items-center gap-1 text-[0.6875rem] font-semibold tabular-nums opacity-80">
        <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
        {time} · {item.kind === "session" ? "Sesi diskusi" : "Tenggat"}
      </span>
      <span className="mt-1 line-clamp-3 block text-body-sm font-semibold leading-snug">
        {title}
      </span>
      <span className="mt-1 block truncate text-[0.6875rem] opacity-80">{item.class_name}</span>
      <span className="mt-1.5 block text-[0.6875rem] font-bold">{style.label}</span>
    </Link>
  );
}
