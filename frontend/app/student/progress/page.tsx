import { CognitiveClassCard } from "@/components/cognitive/CognitiveClassCard";
import { Callout } from "@/components/common/Callout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StudentGradeRecap } from "@/components/student/StudentGradeRecap";
import { getOwnProgress, getStudentClasses } from "@/lib/data";

export default async function ProgressPage() {
  const [progress, classes] = await Promise.all([getOwnProgress(), getStudentClasses()]);
  const analysedCount = progress.classes.reduce(
    (total, series) => total + series.point_count,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progres Belajar"
        subtitle={`Perkembangan cara berpikirmu dari ${analysedCount} tugas yang sudah dianalisis.`}
      />

      <StudentGradeRecap classes={classes} />

      <Callout variant="info" title="Tentang grafik perkembangan">
        Grafik di bawah membaca <strong>bagaimana</strong> kamu menjawab, bukan
        benar atau salahnya. Level rendah bukan berarti jawabanmu buruk, hanya
        berarti jawaban itu lebih banyak mengingat daripada menganalisis. Garis
        putus-putus adalah level yang diminta tugas, jadi kamu tahu ke mana harus
        bergerak.
      </Callout>

      {progress.classes.length === 0 ? (
        <EmptyState
          title="Belum ada grafik perkembangan"
          caption="Progres muncul setelah tugasmu dikumpulkan dan selesai dianalisis."
        />
      ) : (
        progress.classes.map((series) => (
          <CognitiveClassCard key={series.class_id} series={series} />
        ))
      )}
    </div>
  );
}
