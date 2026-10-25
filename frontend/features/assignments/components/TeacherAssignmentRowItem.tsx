import { CalendarClock, ClipboardCheck, ClipboardList, Pencil } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BloomBadge } from "@/features/bloom/components/BloomBadge";
import { isClosed } from "@/features/assignments/lib/teacher-assignments";
import {
  DISPLAY_TIME_ZONE,
  formatClockHHMM,
  formatDate,
  formatRelativeTime,
} from "@/lib/formatting";
import type { TeacherAssignmentRow } from "@/lib/types";

/** Satu tugas: judul, tenggat, target level, jumlah pengumpulan, dan aksi periksa atau ubah. */
export function TeacherAssignmentRowItem({
  item,
  now,
}: {
  item: TeacherAssignmentRow;
  now: number;
}) {
  const closed = isClosed(item, now);
  const detailHref = `/dashboard/classes/${item.class_id}?tab=tugas&assignment=${item.id}`;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:gap-5">
      <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground sm:grid">
        <ClipboardList className="h-5 w-5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Link
            href={detailHref}
            className="break-words font-semibold text-foreground hover:text-brand-ink"
          >
            {item.title}
          </Link>
          <Badge tone={closed ? "neutral" : "info"} size="sm">
            {closed ? "Tenggat lewat" : "Masih dibuka"}
          </Badge>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {item.deadline ? (
            <>
              {formatDate(item.deadline)} · {formatClockHHMM(item.deadline)} ({DISPLAY_TIME_ZONE})
              <span aria-hidden="true">·</span>
              {formatRelativeTime(item.deadline)}
            </>
          ) : (
            "Tanpa tenggat"
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:w-60 lg:justify-end">
        <BloomBadge level={item.expected_bloom_level} variant="code" />
        <span className="text-xs text-muted-foreground">{item.submission_count} terkumpul</span>
        {item.needs_review_count > 0 ? (
          <Badge tone="warning" size="sm">
            {item.needs_review_count} perlu diperiksa
          </Badge>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-2">
        <Button asChild size="sm" variant={item.needs_review_count ? "default" : "outline"}>
          <Link href={`/dashboard/pengumpulan?tugas=${item.id}`}>
            <ClipboardCheck /> Periksa
          </Link>
        </Button>
        <Button asChild size="icon" variant="outline" className="h-9 w-9">
          <Link
            href={`/dashboard/classes/${item.class_id}/assignments/${item.id}/edit`}
            title="Edit tugas"
            aria-label={`Edit tugas ${item.title}`}
          >
            <Pencil />
          </Link>
        </Button>
      </div>
    </div>
  );
}
