import { BookOpen, Layers } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassAnalytics } from "@/features/overview/components/ClassAnalytics";
import { CrossClassReport } from "@/features/reports/components/CrossClassReport";
import { getOverview, getReportOverview } from "@/lib/data";

/**
 * Satu tempat untuk membaca kelas: "Per kelas" (peta kognitif tiap kelas) dan "Lintas kelas"
 * (ringkasan seluruh kelas dan perbandingan per program studi atau semester).
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; kelas?: string }>;
}) {
  const [{ classes }, report, query] = await Promise.all([
    getOverview(),
    getReportOverview(),
    searchParams,
  ]);
  const active = query.tab === "lintas" ? "lintas" : "kelas";

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Analitik</h1>
      <Tabs key={active} defaultValue={active} className="space-y-5">
        <TabsList aria-label="Jenis analitik">
          <TabsTrigger value="kelas">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Per kelas
          </TabsTrigger>
          <TabsTrigger value="lintas">
            <Layers className="h-4 w-4" aria-hidden="true" />
            Lintas kelas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="kelas" className="mt-0">
          <ClassAnalytics classes={classes} initialClassId={query.kelas} />
        </TabsContent>
        <TabsContent value="lintas" className="mt-0">
          <CrossClassReport report={report} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
