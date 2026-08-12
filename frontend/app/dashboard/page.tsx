import { LayoutGrid, TrendingDown, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Callout } from "@/components/common/Callout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ClassOverviewSection } from "@/components/overview/ClassOverviewSection";
import { Button } from "@/components/ui/button";
import { getOverview } from "@/lib/data";

export default async function DashboardPage() {
  const { classes } = await getOverview();
  const belowTarget = classes.reduce((sum, item) => sum + item.below_target_count, 0);
  const flagged = classes.reduce((sum, item) => sum + item.high_band_count, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        subtitle="Ringkasan kelas yang Anda ampu, dibaca dari dua sisi sekaligus."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/classes">Daftar kelas</Link>
          </Button>
        }
      />

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

          <Callout variant="info" title="Dua angka di atas mengukur hal yang berbeda">
            Yang tertinggal dari target adalah temuan <strong>terukur</strong> dari
            teks jawaban. Yang berskor AI tinggi baru <strong>dugaan</strong> yang
            harus diverifikasi lewat percakapan. Keduanya sering menunjuk mahasiswa
            yang berbeda, dan itu bukan kesalahan sistem melainkan alasan kedua
            sumbu ini dipisahkan.
          </Callout>

          {classes.map((item) => (
            <ClassOverviewSection key={item.class_id} data={item} />
          ))}
        </>
      )}
    </div>
  );
}
