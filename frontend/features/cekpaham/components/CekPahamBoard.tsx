"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterPills } from "@/components/shared/FilterPills";
import { SearchInput } from "@/components/shared/IconInput";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  AttemptStatusBadge,
  BandBadge,
  PhaseBadge,
} from "@/features/cekpaham/components/CekPahamBadges";
import {
  BOARD_STATUS_LABEL,
  filterBoard,
  matchesBoardStatus,
  type BoardStatus,
} from "@/features/cekpaham/lib/board";
import { formatRelativeTime } from "@/lib/formatting";
import type { CekPahamRow } from "@/lib/types";

/** Daftar Cek Paham: saring menurut kelas dan status, cari nama atau tugas. */
export function CekPahamBoard({ rows }: { rows: CekPahamRow[] }) {
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<BoardStatus>("perlu");
  const [query, setQuery] = useState("");

  const classes = [...new Map(rows.map((row) => [row.class_id, row.class_name])).entries()];
  const inScope = filterBoard(rows, { classId, query });
  const shown = inScope.filter((row) => matchesBoardStatus(row, status));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        {classes.length > 1 ? (
          <NativeSelect
            aria-label="Saring menurut kelas"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            className="sm:w-64"
          >
            <option value="">Semua kelas ({classes.length})</option>
            {classes.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <div className="min-w-0 flex-1">
          <SearchInput
            aria-label="Cari mahasiswa atau tugas"
            placeholder="Cari mahasiswa atau tugas"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <FilterPills
        label="Saring menurut status"
        value={status}
        onChange={setStatus}
        options={(Object.keys(BOARD_STATUS_LABEL) as BoardStatus[]).map((value) => ({
          value,
          label: BOARD_STATUS_LABEL[value],
          count: inScope.filter((row) => matchesBoardStatus(row, value)).length,
        }))}
      />

      {shown.length ? (
        <Card className="overflow-clip">
          <ul className="divide-y divide-border/70">
            {shown.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/dashboard/cekpaham/${row.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                >
                  <AvatarInitials name={row.student_name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">
                      {row.student_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.assignment_title} · {row.class_name} · dibuat{" "}
                      {formatRelativeTime(row.created_at)}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                      <RowBadges row={row} />
                    </span>
                  </span>
                  <span className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
                    <RowBadges row={row} />
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState
          title={rows.length ? "Tidak ada yang cocok" : "Belum ada Cek Paham"}
          caption={
            rows.length
              ? "Ubah kelas, status, atau kata kunci."
              : "Buka satu jawaban mahasiswa, lalu pilih “Minta Cek Paham”."
          }
        />
      )}
    </div>
  );
}

function RowBadges({ row }: { row: CekPahamRow }) {
  if (row.status === "cancelled") return <Badge tone="neutral">Dibatalkan</Badge>;
  return (
    <>
      {row.attempt ? (
        <AttemptStatusBadge status={row.attempt.status} />
      ) : (
        <PhaseBadge phase={row.phase} />
      )}
      {row.attempt?.ai_band ? <BandBadge band={row.attempt.ai_band} /> : null}
      {row.attempt && row.attempt.open_reports > 0 ? (
        <Badge tone="warning">{row.attempt.open_reports} laporan</Badge>
      ) : null}
    </>
  );
}
