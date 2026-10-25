import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { CopyJoinCode } from "@/features/classes/components/CopyJoinCode";
import { academicLabel } from "@/features/classes/lib/academic";
import type { ClassSummary } from "@/lib/types";

/** Kepala halaman kelas dosen: identitas kelas, kode gabung yang bisa disalin, dan tombol membuat tugas. */
export function TeacherClassHeader({ klass }: { klass: ClassSummary }) {
  return (
    <Card className="px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
          <IconTile icon={BookOpen} size="lg" />
          <div className="min-w-0">
            <h1 className="break-words text-title font-bold text-foreground">{klass.name}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{academicLabel(klass)}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Kode gabung <CopyJoinCode code={klass.join_code} />
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
