import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { AgendaRow } from "@/features/schedule/components/AgendaRow";
import type { ScheduleItem } from "@/lib/types";

const SHOWN = 3;

/** Tenggat dan batas Cek Paham terdekat, dengan jalan pintas ke kalender lengkap. */
export function UpcomingCard({ items }: { items: ScheduleItem[] }) {
  const now = new Date();
  const upcoming = items
    .filter((item) => new Date(item.at).getTime() >= now.getTime())
    .slice(0, SHOWN);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconTile icon={CalendarDays} size="sm" />
          <h2 className="font-bold text-foreground">Jadwal terdekat</h2>
        </div>
        <Link
          href="/student/jadwal"
          className="text-xs font-semibold text-brand-ink hover:underline"
        >
          Kalender
        </Link>
      </div>
      {upcoming.length ? (
        <ul className="mt-3 -mx-2 divide-y divide-border/60">
          {upcoming.map((item) => (
            <li key={item.id}>
              <AgendaRow item={item} now={now} compact />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Tidak ada tenggat dalam waktu dekat.</p>
      )}
    </Card>
  );
}
