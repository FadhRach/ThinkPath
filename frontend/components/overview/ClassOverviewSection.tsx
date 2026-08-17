import Link from "next/link";

import {
  AiBloomScatter,
  BloomDistributionChart,
  CohortTrendChart,
} from "@/components/charts";
import { DataTable, DataTableRow } from "@/components/common/DataTable";
import { SectionCard } from "@/components/common/SectionCard";
import { TREND_LABEL, bloomAxisCaption } from "@/lib/cognitive";
import type { OverviewClass } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUADRANT_LEGEND = [
  {
    color: "hsl(var(--warning))",
    label: "Tertinggal, dugaan AI rendah",
    caption: "Celah pemahaman. Terukur, dan paling sering luput.",
  },
  {
    color: "hsl(var(--danger))",
    label: "Tertinggal, dugaan AI tinggi",
    caption: "Dua masalah sekaligus. Mulai dari percakapan.",
  },
  {
    color: "hsl(var(--brand-teal))",
    label: "Sesuai target, dugaan AI tinggi",
    caption: "Mampu, tetapi prosesnya perlu ditanyakan.",
  },
  {
    color: "hsl(var(--muted-foreground))",
    label: "Sesuai target, dugaan AI rendah",
    caption: "Tidak menuntut tindakan.",
  },
];

export function ClassOverviewSection({ data }: { data: OverviewClass }) {
  const attention = data.students.filter(
    (student) => student.gap !== null && student.gap <= -1,
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">{data.class_name}</h2>
          <p className="text-body-sm text-muted-foreground">{data.subject}</p>
        </div>
        <Link
          href={`/dashboard/classes/${data.class_id}`}
          className="text-body-sm text-muted-foreground hover:text-primary"
        >
          Buka kelas
        </Link>
      </div>

      <SectionCard eyebrow="Peta Kelas" className="space-y-4">
        <p className="text-body-sm text-muted-foreground">
          Setiap titik satu mahasiswa. Sumbu tegak selisih level Bloom terhadap
          target tugas, sumbu datar rata-rata dugaan AI. Klik titik untuk
          membuka profil kognitifnya.
        </p>

        <AiBloomScatter students={data.students} />

        <div className="grid gap-2.5 sm:grid-cols-2">
          {QUADRANT_LEGEND.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="min-w-0">
                <span className="block text-body-sm font-medium text-foreground">
                  {item.label}
                </span>
                <span className="block text-caption text-muted-foreground">
                  {item.caption}
                </span>
              </span>
            </div>
          ))}
        </div>

        {attention.length > 0 ? (
          <p className="rounded-lg bg-warning-soft px-3.5 py-2.5 text-body-sm text-foreground">
            <strong>{attention.length} mahasiswa</strong> tertinggal minimal satu
            tingkat dari target, dan{" "}
            <strong>
              {attention.filter((student) => student.high_count === 0).length} di
              antaranya tidak pernah berskor AI tinggi
            </strong>
            . Mereka mengerjakan sendiri, tetapi belum sampai ke level yang diminta.
          </p>
        ) : null}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard eyebrow="Sebaran Level" className="space-y-2">
          <p className="text-body-sm text-muted-foreground">
            {bloomAxisCaption(data.bloom_distribution) ||
              "Seluruh submission yang sudah dianalisis"}
          </p>
          <div className="pt-2">
            <BloomDistributionChart
              bins={data.bloom_distribution}
              target={data.average_target}
            />
          </div>
        </SectionCard>

        <SectionCard eyebrow="Tren Kelas" className="space-y-2">
          <p className="text-body-sm text-muted-foreground">
            Rata-rata kelas terhadap target yang menanjak, tugas demi tugas
          </p>
          <div className="pt-2">
            <CohortTrendChart points={data.cohort_trend} />
          </div>
        </SectionCard>
      </div>

      {attention.length > 0 ? (
        <SectionCard eyebrow="Perlu Perhatian Pengajaran">
          <DataTable
            minWidthClass="min-w-[32rem]"
            headers={["Mahasiswa", "Level", "Selisih", "Arah", "Rata-rata AI"]}
          >
            {attention.map((student) => (
              <DataTableRow key={student.student_id}>
                <td className="py-2.5 pr-4">
                  <Link
                    href={`/dashboard/students/${student.student_id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {student.display_name}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  L{student.current_level}
                </td>
                <td className="py-2.5 pr-4 font-medium text-warning">
                  {student.gap}
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {TREND_LABEL[student.direction]}
                </td>
                <td
                  className={cn(
                    "py-2.5",
                    student.high_count > 0 ? "text-danger" : "text-muted-foreground",
                  )}
                >
                  {student.ai_mean}
                </td>
              </DataTableRow>
            ))}
          </DataTable>
        </SectionCard>
      ) : null}
    </section>
  );
}
