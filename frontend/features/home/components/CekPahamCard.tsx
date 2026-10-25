import { Mic } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { queueStats } from "@/features/cekpaham/lib/queue";
import type { CekPahamRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Ringkasan Cek Paham: yang menunggu dikerjakan, laporan kendala terbuka, dan yang sudah dinilai.
 * Judul bagiannya ditulis halaman (sejajar dengan judul "Kelas yang Anda ajar"), jadi kartu ini
 * sejajar dengan kartu kelas di sebelahnya.
 */
export function CekPahamCard({ rows }: { rows: CekPahamRow[] }) {
  const stats = queueStats(rows);
  const items = [
    { label: "Menunggu dikerjakan", value: stats.waiting, alert: false },
    { label: "Laporan kendala terbuka", value: stats.openReports, alert: stats.openReports > 0 },
    { label: "Sudah dinilai", value: stats.scored, alert: false },
  ];

  return (
    <Card className="flex h-full flex-col justify-center p-5">
      <div className="flex items-center gap-2.5">
        <IconTile icon={Mic} size="sm" />
        <p className="text-sm text-muted-foreground">Tes lisan atas jawaban mahasiswa</p>
      </div>
      <dl className="mt-3 divide-y divide-border/60">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-2.5 text-sm">
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd
              className={cn(
                "text-lg font-bold tabular-nums",
                item.alert ? "text-warning" : "text-foreground",
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
