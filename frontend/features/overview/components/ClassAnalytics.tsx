import { LayoutGrid, TrendingDown, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ClassOverviewSection } from "@/features/overview/components/ClassOverviewSection";
import { OverviewClassTabs } from "@/features/overview/components/OverviewClassTabs";
import type { OverviewClass } from "@/lib/types";

/** Analitik per kelas: dua angka kunci lalu satu kelas terlihat pada satu waktu. */
export function ClassAnalytics({
  classes,
  initialClassId,
}: {
  classes: OverviewClass[];
  initialClassId?: string;
}) {
  const belowTarget = classes.reduce((sum, item) => sum + item.below_target_count, 0);
  const flagged = classes.reduce((sum, item) => sum + item.high_band_count, 0);

  return (
    <div className="space-y-6">
      {classes.length === 0 ? (
        <EmptyState
          title="Belum ada kelas"
          caption="Buat kelas pertama untuk mulai memantau pola berpikir mahasiswa."
          action={
            <Button asChild>
              <Link href="/dashboard/classes/new">Buat kelas</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={LayoutGrid} label="Kelas diampu" value={classes.length} />
            <StatCard
              icon={TrendingDown}
              label="Tertinggal dari target"
              value={belowTarget}
              tone={belowTarget > 0 ? "warning" : "brand"}
              hint="Terukur dari teks jawaban"
            />
            <StatCard
              icon={TriangleAlert}
              label="Pernah berskor AI tinggi"
              value={flagged}
              tone={flagged > 0 ? "danger" : "brand"}
              hint="Masih dugaan, belum diverifikasi"
            />
          </div>

          <Alert variant="info" title="Dua angka di atas mengukur hal yang berbeda">
            Yang tertinggal dari target adalah temuan <strong>terukur</strong> dari teks jawaban.
            Yang berskor AI tinggi baru <strong>dugaan</strong> yang harus diverifikasi lewat
            percakapan. Keduanya sering menunjuk mahasiswa yang berbeda, dan itu bukan kesalahan
            sistem melainkan alasan kedua sumbu ini dipisahkan.
          </Alert>

          {classes.length === 1 ? (
            <ClassOverviewSection data={classes[0]} />
          ) : (
            <OverviewClassTabs
              initialId={initialClassId}
              tabs={classes.map((item) => ({
                id: item.class_id,
                label: item.class_name,
                belowCount: item.below_target_count,
                content: <ClassOverviewSection data={item} showTitle={false} />,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
