import { ChevronRight, Hourglass } from "lucide-react";
import Link from "next/link";

import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { AiBandBadge } from "@/features/submissions/components/AiBandBadge";
import { StatusBadge } from "@/features/submissions/components/StatusBadge";
import { levelGap } from "@/features/submissions/lib/review";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { TeacherSubmissionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Kolom baris pemeriksaan di layar lebar; judul kolomnya ada di ReviewGroupCard. */
export const REVIEW_COLUMNS =
  "lg:grid lg:grid-cols-[minmax(0,1.4fr)_10rem_9rem_7rem_9rem_1rem] lg:items-center lg:gap-4";

/** Satu pengumpulan: mahasiswa, waktu, status, level hasil terhadap target, dan indikasi AI. */
export function ReviewRow({ row, target }: { row: TeacherSubmissionRow; target: number }) {
  const analysing = row.analysis_state === "pending" || row.analysis_state === "running";
  const gap = levelGap(row, target);

  return (
    <Link
      href={`/dashboard/submission/${row.id}`}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5",
        REVIEW_COLUMNS,
      )}
    >
      <span className="flex min-w-0 basis-full items-center gap-3 lg:basis-auto">
        <AvatarInitials name={row.student.display_name} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-foreground">
            {row.student.display_name}
          </span>
          {row.revision_count > 0 ? (
            <span className="text-xs text-muted-foreground">Revisi {row.revision_count}×</span>
          ) : null}
        </span>
      </span>

      <span className="text-xs text-muted-foreground">
        <span className="block text-foreground">{formatRelativeTime(row.submitted_at)}</span>
        {formatDate(row.submitted_at)}
      </span>

      <span className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={row.status} />
        {row.grade !== null ? (
          <span className="text-xs font-bold tabular-nums text-success">{row.grade}</span>
        ) : null}
      </span>

      <span className="text-sm tabular-nums">
        {row.analysis ? (
          <span
            className={cn(
              "font-semibold",
              gap !== null && gap < 0 ? "text-warning" : "text-foreground",
            )}
            title={`Level hasil L${row.analysis.bloom_level}, target L${target}`}
          >
            L{row.analysis.bloom_level}
            <span className="font-normal text-muted-foreground"> / L{target}</span>
          </span>
        ) : analysing ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Hourglass className="h-3 w-3" aria-hidden="true" /> Dianalisis
          </span>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </span>

      <span className="flex flex-wrap items-center gap-1.5">
        {row.analysis ? <AiBandBadge band={row.analysis.ai_band} /> : null}
        {row.analysis?.process_band === "attention" ? (
          <Badge tone="warning" size="sm">
            Pola proses
          </Badge>
        ) : null}
        {row.analysis_state === "failed" ? (
          <Badge tone="danger" size="sm">
            Analisis gagal
          </Badge>
        ) : null}
      </span>

      <ChevronRight className="hidden h-4 w-4 text-muted-foreground lg:block" aria-hidden="true" />
    </Link>
  );
}
