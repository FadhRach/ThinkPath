"use client";

import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { InfoHint } from "@/components/shared/InfoHint";
import { Badge } from "@/components/ui/badge";
import { BloomLevelGuide } from "@/features/bloom/components/BloomLevelGuide";
import { classProgress } from "@/features/classes/lib/student-class";
import { GradeReport } from "@/features/gradebook/components/GradeReport";
import { CognitiveClassCard } from "@/features/overview/components/CognitiveClassCard";
import type { CognitiveClassSeries, StudentClassWithAssignments } from "@/lib/types";

interface ClassGradebookProps {
  studentClass: StudentClassWithAssignments;
  /** Seri perkembangan Bloom untuk kelas ini; kosong bila belum ada tugas yang dianalisis. */
  growth: CognitiveClassSeries | undefined;
}

/** Rapor satu kelas: nilai tugas dengan rata-ratanya, dan grafik perkembangan cara berpikir. */
export function ClassGradebook({ studentClass, growth }: ClassGradebookProps) {
  const progress = classProgress(studentClass);

  return (
    <div className="space-y-6">
      <CollapsibleSection
        title="Nilai tugas"
        defaultOpen={false}
        summary={
          <>
            <span className="text-xs text-muted-foreground">
              {progress.graded} dari {progress.total} tugas dinilai
            </span>
            <Badge tone="brand" size="md" className="tabular-nums">
              Rata-rata {progress.average ?? "–"}
            </Badge>
          </>
        }
      >
        <GradeReport studentClass={studentClass} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Perkembangan cara berpikir"
        defaultOpen={false}
        hint={
          <InfoHint label="Cara membaca grafik">
            <p>
              Grafik membaca <strong>bagaimana</strong> kamu menjawab, bukan benar atau salahnya.
              Level rendah hanya berarti jawabanmu lebih banyak mengingat daripada menganalisis.
              Garis putus-putus adalah level yang diminta tugas.
            </p>
            <BloomLevelGuide />
          </InfoHint>
        }
        summary={
          growth?.current_level != null ? (
            <Badge tone="info" size="md" className="tabular-nums">
              Level saat ini L{growth.current_level.toFixed(1)}
            </Badge>
          ) : null
        }
      >
        {growth ? (
          <CognitiveClassCard series={growth} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Grafik muncul setelah tugasmu di kelas ini dikumpulkan dan selesai dianalisis.
          </p>
        )}
      </CollapsibleSection>
    </div>
  );
}
