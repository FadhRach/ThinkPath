import { ArrowUpRight, CalendarClock } from "lucide-react";
import Link from "next/link";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type StudentTaskRow } from "@/features/assignments/lib/student-tasks";
import { urgencyOf } from "@/features/assignments/lib/urgency";
import { ClassChip } from "@/features/classes/components/ClassChip";
import { BloomBadge } from "@/features/bloom/components/BloomBadge";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";

function statusOf(row: StudentTaskRow): { label: string; tone: BadgeTone } {
  return row.submission
    ? { label: "Sedang dikerjakan", tone: "info" }
    : { label: "Belum dimulai", tone: "neutral" };
}

/** Kartu tugas yang masih harus dikerjakan: judul, kelas, status, level Bloom, tenggat, dan tombol kerjakan. */
export function StudentTaskCard({ row }: { row: StudentTaskRow }) {
  const status = statusOf(row);
  const urgency = urgencyOf(row.deadline);
  const href = `/student/submit/${row.assignmentId}`;

  return (
    <Card className="p-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <ClassChip name={row.className} />
          <Link
            href={href}
            className="mt-2 block font-semibold text-foreground hover:text-brand-ink"
          >
            {row.title}
          </Link>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {urgency === "overdue" ? <Badge tone="danger">Lewat tenggat</Badge> : null}
            {urgency === "soon" ? <Badge tone="warning">Segera tenggat</Badge> : null}
            <BloomBadge level={row.expectedLevel} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 sm:w-48 sm:shrink-0 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
          <div
            className={cn(
              "text-xs",
              urgency === "overdue" ? "text-danger" : "text-muted-foreground",
            )}
          >
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {row.deadline ? formatDate(row.deadline) : "Tanpa tenggat"}
            </span>
            {row.deadline ? (
              <span className="mt-0.5 block sm:text-right">{formatRelativeTime(row.deadline)}</span>
            ) : null}
          </div>
          <Button asChild size="sm">
            <Link href={href}>
              {row.submission ? "Lanjutkan" : "Kerjakan"} <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
