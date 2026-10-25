import { CheckCircle2, Hourglass, MessageSquareWarning } from "lucide-react";

import { StatCard } from "@/components/shared/StatCard";
import { CekPahamBoard } from "@/features/cekpaham/components/CekPahamBoard";
import { UNCALIBRATED_NOTE } from "@/features/cekpaham/lib/labels";
import { queueStats } from "@/features/cekpaham/lib/queue";
import { getCekPahamQueue } from "@/lib/data";

export default async function CekPahamListPage() {
  const rows = await getCekPahamQueue();
  const stats = queueStats(rows);

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Cek Paham</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Hourglass} label="Menunggu dikerjakan" value={stats.waiting} />
        <StatCard icon={CheckCircle2} label="Hasil siap ditinjau" value={stats.scored} />
        <StatCard
          icon={MessageSquareWarning}
          label="Laporan menunggu"
          value={stats.openReports}
          tone={stats.openReports > 0 ? "warning" : "brand"}
        />
      </div>

      <CekPahamBoard rows={rows} />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Tes lisan singkat atas jawaban mahasiswa, dijawab dengan suara, dimintakan dari halaman
        jawaban. {UNCALIBRATED_NOTE} Hasilnya tidak mengubah skor AI maupun nilai; keputusan tetap
        di tangan Anda.
      </p>
    </div>
  );
}
