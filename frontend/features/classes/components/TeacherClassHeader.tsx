import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { academicLabel } from "@/features/classes/lib/academic";
import type { ClassSummary } from "@/lib/types";

/** Kepala halaman kelas dosen: identitas kelas, kode gabung, dan tombol membuat tugas. */
export function TeacherClassHeader({ klass }: { klass: ClassSummary }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={BookOpen} tone="solid" size="lg" />
          <div className="min-w-0">
            <p className="caption-eyebrow text-brand-ink">Ruang kelas · {academicLabel(klass)}</p>
            <h1 className="mt-1 break-words text-title font-bold">{klass.name}</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              Kode gabung{" "}
              <span className="ml-1 rounded-md border border-border bg-muted px-2 py-1 tabular-nums font-bold tracking-wider text-brand-ink">
                {klass.join_code}
              </span>
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href={`/dashboard/classes/${klass.id}/assignments/new`}>
            <Plus /> Buat tugas
          </Link>
        </Button>
      </div>
    </Card>
  );
}
