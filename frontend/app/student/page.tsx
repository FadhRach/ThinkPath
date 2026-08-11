import { BookOpen, CheckCircle2, GraduationCap, Star } from "lucide-react";

import { GradeBarChart, type GradePoint } from "@/components/common/GradeBarChart";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { JoinCodeForm } from "@/components/student/JoinCodeForm";
import { StudentClassCard } from "@/components/student/StudentClassCard";
import { Card } from "@/components/ui/card";
import { getMe, getStudentClasses } from "@/lib/data";
import type { StudentClassWithAssignments } from "@/lib/types";

interface Overview {
  activeCount: number;
  doneCount: number;
  averageGrade: number | null;
  gradeChart: GradePoint[];
}

// Ringkasan di beranda sengaja hanya soal nilai dan jumlah tugas. Grafik level
// kognitif punya halamannya sendiri di /student/progres, lengkap dengan
// penjelasan bahwa level bukan nilai.
function deriveOverview(classes: StudentClassWithAssignments[]): Overview {
  const graded: Array<{ label: string; grade: number }> = [];
  let activeCount = 0;

  for (const cls of classes) {
    for (const assignment of cls.assignments) {
      const submission = assignment.submission;
      const isGraded = submission?.status === "reviewed" && submission.grade !== null;
      if (isGraded && submission) {
        graded.push({ label: cls.subject, grade: submission.grade as number });
      } else {
        activeCount += 1;
      }
    }
  }

  const averageGrade =
    graded.length > 0
      ? Math.round((graded.reduce((sum, g) => sum + g.grade, 0) / graded.length) * 10) / 10
      : null;

  return {
    activeCount,
    doneCount: graded.length,
    averageGrade,
    gradeChart: graded.slice(-6).map((g) => ({ label: g.label, value: g.grade })),
  };
}

const TODAY = new Date().toLocaleDateString("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function StudentPage() {
  const [me, classes] = await Promise.all([getMe(), getStudentClasses()]);
  const overview = deriveOverview(classes);
  const firstName = (me.display_name || me.email).split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Selamat datang, ${firstName}`}
        subtitle={`${TODAY} · ${overview.activeCount} tugas menunggu diselesaikan`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={BookOpen} label="Tugas aktif" value={overview.activeCount} />
        <StatCard icon={CheckCircle2} label="Tugas selesai" value={overview.doneCount} />
        <StatCard
          icon={Star}
          label="Rata-rata nilai"
          value={overview.averageGrade ?? "-"}
        />
        <StatCard icon={GraduationCap} label="Kelas diikuti" value={classes.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {classes.length === 0 ? (
            <Card className="border-dashed p-10 text-center text-body text-muted-foreground shadow-none">
              Kamu belum bergabung ke kelas mana pun. Minta kode kelas ke gurumu,
              lalu masukkan di samping.
            </Card>
          ) : (
            classes.map((studentClass) => (
              <StudentClassCard key={studentClass.id} studentClass={studentClass} />
            ))
          )}
        </div>

        <div className="space-y-6">
          <Card className="space-y-3 p-5 shadow-soft">
            <div>
              <h2 className="font-bold text-foreground">Gabung kelas</h2>
              <p className="text-body-sm text-muted-foreground">
                Masukkan kode undangan dari gurumu.
              </p>
            </div>
            <JoinCodeForm />
          </Card>

          {overview.gradeChart.length > 0 ? (
            <Card className="space-y-1 p-5 shadow-soft">
              <h2 className="font-bold text-foreground">Nilai Tugas Terakhir</h2>
              <p className="text-body-sm text-muted-foreground">
                {overview.gradeChart.length} tugas terakhir yang dinilai
              </p>
              <div className="pt-3">
                <GradeBarChart data={overview.gradeChart} />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
