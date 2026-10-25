import { ClipboardCheck } from "lucide-react";
import Link from "next/link";

import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { ClassChip } from "@/features/classes/components/ClassChip";
import { formatRelativeTime } from "@/lib/formatting";
import type { TeacherSubmissionRow } from "@/lib/types";

/**
 * Antrean kerja utama dosen: pengumpulan yang menunggu dinilai, yang paling lama menunggu di atas
 * (yang lebih dulu dikumpulkan lebih dulu diperiksa). Daftarnya menggulir di dalam kartu, jadi
 * antrean yang panjang tidak merusak tata letak beranda.
 */
export function ReviewQueueCard({ submissions }: { submissions: TeacherSubmissionRow[] }) {
  const waiting = submissions
    .filter((row) => row.status === "submitted")
    .sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconTile icon={ClipboardCheck} size="sm" />
          <div>
            <h2 className="font-bold text-foreground">Perlu diperiksa</h2>
            <p className="text-xs text-muted-foreground">
              {waiting.length
                ? `${waiting.length} menunggu nilai`
                : "Semua pengumpulan sudah diperiksa"}
            </p>
          </div>
        </div>
        {waiting.length ? (
          <Button asChild size="sm">
            <Link href="/dashboard/pengumpulan">Periksa</Link>
          </Button>
        ) : null}
      </div>

      {waiting.length ? (
        <ul className="mt-3 max-h-96 divide-y divide-border/60 overflow-y-auto pr-1 xl:max-h-none xl:min-h-0 xl:flex-1">
          {waiting.map((row) => (
            <li key={row.id}>
              <Link
                href={`/dashboard/submission/${row.id}`}
                className="flex items-center gap-3 py-3 hover:bg-muted/50 sm:-mx-2 sm:px-2 sm:rounded-lg"
              >
                <AvatarInitials name={row.student.display_name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {row.student.display_name}
                    </span>
                    {row.revision_count > 0 ? (
                      <Badge tone="info" size="sm">
                        Revisi {row.revision_count}×
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.assignment_title}
                  </span>
                  <ClassChip name={row.class_name} className="mt-0.5" />
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  {formatRelativeTime(row.submitted_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          variant="inline"
          title="Antrean kosong"
          caption="Pengumpulan baru dari mahasiswa akan muncul di sini."
        />
      )}
    </Card>
  );
}
