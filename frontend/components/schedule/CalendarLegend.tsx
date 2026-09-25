import { MessagesSquare } from "lucide-react";

import { AGENDA_STYLE, type AgendaState } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const DEADLINE_ENTRIES: Array<{ state: AgendaState; label: string }> = [
  { state: "todo", label: "Belum dikerjakan" },
  { state: "submitted", label: "Terkumpul" },
  { state: "graded", label: "Dinilai" },
  { state: "missed", label: "Terlewat" },
];

export function CalendarLegend() {
  return (
    <ul
      aria-label="Keterangan warna"
      className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-caption text-muted-foreground"
    >
      {DEADLINE_ENTRIES.map((entry) => (
        <li key={entry.state} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("h-2.5 w-2.5 rounded-full", AGENDA_STYLE[entry.state].mark)}
          />
          {entry.label}
        </li>
      ))}
      {/* Sesi digambar seperti kartunya di kalender, bukan titik, supaya tidak
          tertukar dengan warna "Terkumpul" yang sama-sama kehijauan. */}
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="grid h-4 w-4 place-items-center rounded bg-primary text-primary-foreground"
        >
          <MessagesSquare className="h-2.5 w-2.5" />
        </span>
        Sesi diskusi jawaban
      </li>
    </ul>
  );
}
