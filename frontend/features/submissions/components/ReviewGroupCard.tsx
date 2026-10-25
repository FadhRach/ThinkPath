import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BloomBadge } from "@/features/bloom/components/BloomBadge";
import { ClassChip } from "@/features/classes/components/ClassChip";
import { REVIEW_COLUMNS, ReviewRow } from "@/features/submissions/components/ReviewRow";
import type { ReviewGroup } from "@/features/submissions/lib/review";
import { formatDate } from "@/lib/formatting";
import { cn } from "@/lib/utils";

const HEADERS = ["Mahasiswa", "Dikumpulkan", "Status", "Level / target", "Indikasi AI"];

/** Satu tugas dan pengumpulannya. Nama tugas ditonjolkan karena dosen memeriksa per tugas. */
export function ReviewGroupCard({ group }: { group: ReviewGroup }) {
  const { assignment, rows, waiting } = group;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3.5 sm:px-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-heading font-semibold text-foreground">
            <Link
              href={`/dashboard/classes/${assignment.class_id}?tab=tugas&assignment=${assignment.id}`}
              className="hover:text-brand-ink"
            >
              {assignment.title}
            </Link>
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ClassChip name={assignment.class_name} />
            <span className="text-xs text-muted-foreground">
              Tenggat {assignment.deadline ? formatDate(assignment.deadline) : "tidak ada"}
            </span>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <BloomBadge level={assignment.expected_bloom_level} variant="code" />
          {waiting > 0 ? (
            <Badge tone="warning">{waiting} perlu diperiksa</Badge>
          ) : (
            <Badge tone="success">Tuntas</Badge>
          )}
        </div>
      </div>

      <div
        className={cn(
          "hidden border-b border-border/70 px-5 py-2 text-xs font-semibold text-muted-foreground",
          REVIEW_COLUMNS,
        )}
        aria-hidden="true"
      >
        {HEADERS.map((header) => (
          <span key={header}>{header}</span>
        ))}
        <span />
      </div>

      <ul className="divide-y divide-border/70">
        {rows.map((row) => (
          <li key={row.id}>
            <ReviewRow row={row} target={assignment.expected_bloom_level} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
