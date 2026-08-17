import { DataTable, DataTableRow } from "@/components/common/DataTable";
import { bloomCode } from "@/lib/bloom";
import type { ReportGroupMetrics } from "@/lib/types";

interface Row extends ReportGroupMetrics {
  key: string;
  label: string;
  sublabel?: string;
}

interface Props {
  rows: Row[];
  /** Judul kolom pertama, misalnya "Kelas" atau "Program studi". */
  firstColumn: string;
  emptyMessage: string;
}

function ratioTone(ratio: number | null): string {
  if (ratio === null) return "text-muted-foreground";
  if (ratio >= 0.5) return "text-danger";
  if (ratio >= 0.25) return "text-warning";
  return "text-foreground";
}

/**
 * Tabel metrik per pengelompokan.
 *
 * Kolom pertama setelah nama adalah kesenjangan kognitif, bukan indikasi AI.
 * Urutan kolom itu disengaja: yang pertama dibaca dosen harus pertanyaan
 * pedagogis, bukan pertanyaan kecurigaan.
 */
export function GroupTable({ rows, firstColumn, emptyMessage }: Props) {
  if (rows.length === 0) {
    return <p className="text-body-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <DataTable
      minWidthClass="min-w-[36rem]"
      headers={[
        firstColumn,
        "Di bawah target",
        "Rata-rata Bloom",
        "Dianalisis",
        "Indikasi AI tinggi",
      ]}
    >
      {rows.map((row) => (
        <DataTableRow key={row.key}>
          <td className="py-2.5 pr-4">
            <span className="font-medium text-foreground">{row.label}</span>
            {row.sublabel ? (
              <span className="block text-caption text-muted-foreground">
                {row.sublabel}
              </span>
            ) : null}
          </td>
          <td className={`py-2.5 pr-4 tabular-nums ${ratioTone(row.below_target_ratio)}`}>
            {row.below_target_ratio === null
              ? "-"
              : `${row.below_target_count} (${Math.round(row.below_target_ratio * 100)}%)`}
          </td>
          <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">
            {row.avg_bloom === null ? "-" : `${bloomCode(Math.round(row.avg_bloom))} (${row.avg_bloom})`}
          </td>
          <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">
            {row.analysed_count}
          </td>
          <td className="py-2.5 tabular-nums text-muted-foreground">
            {row.high_band_count}
          </td>
        </DataTableRow>
      ))}
    </DataTable>
  );
}
