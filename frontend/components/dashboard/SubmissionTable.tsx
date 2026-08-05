"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AvatarInitials } from "@/components/common/AvatarInitials";
import { BloomBadge } from "@/components/common/BloomBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/formatting";
import type { SubmissionRow } from "@/lib/types";
import { aiBandBadgeClass, aiBandLabel } from "@/lib/ui";
import { cn } from "@/lib/utils";

type Filter = "all" | "needs_review" | "high_ai";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Semua" },
  { id: "needs_review", label: "Perlu review" },
  { id: "high_ai", label: "AI tinggi" },
];

function matchesFilter(row: SubmissionRow, filter: Filter): boolean {
  if (filter === "needs_review") return row.status === "submitted";
  if (filter === "high_ai") return row.analysis?.ai_band === "high";
  return true;
}

export function SubmissionTable({ submissions }: { submissions: SubmissionRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return submissions.filter(
      (row) =>
        matchesFilter(row, filter) &&
        (keyword === "" ||
          row.student.display_name.toLowerCase().includes(keyword)),
    );
  }, [submissions, query, filter]);

  return (
    <Card className="overflow-hidden shadow-soft">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama mahasiswa..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-body-sm transition",
                filter === option.id
                  ? "border-primary bg-secondary font-semibold text-secondary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="caption-eyebrow">Mahasiswa</TableHead>
              <TableHead className="caption-eyebrow">Skor AI</TableHead>
              <TableHead className="caption-eyebrow">Level Kognitif</TableHead>
              <TableHead className="caption-eyebrow">Nilai</TableHead>
              <TableHead className="caption-eyebrow">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-body-sm text-muted-foreground"
                >
                  Tidak ada submission yang cocok dengan pencarian.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={row.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/dashboard/submission/${row.id}`}
                      className="flex items-center gap-3"
                    >
                      <AvatarInitials name={row.student.display_name} size="sm" />
                      <span>
                        <span className="flex items-center gap-2 font-semibold text-foreground">
                          {row.student.display_name}
                          {row.revision_count > 0 ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              Revisi {row.revision_count}x
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-body-sm text-muted-foreground">
                          {formatRelativeTime(row.submitted_at)}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {row.analysis ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                          aiBandBadgeClass(row.analysis.ai_band),
                        )}
                      >
                        {aiBandLabel(row.analysis.ai_band)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.analysis ? (
                      <BloomBadge level={row.analysis.bloom_level} />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {row.grade ?? "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
