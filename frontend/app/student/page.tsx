import { BookOpen, CheckCircle2, GraduationCap, Star } from "lucide-react";

import { GradeBarChart, type GradePoint } from "@/components/common/GradeBarChart";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { JoinCodeForm } from "@/components/student/JoinCodeForm";
import { StudentClassCard } from "@/components/student/StudentClassCard";
import { Card } from "@/components/ui/card";
import { getMe, getStudentClasses } from "@/lib/data";
import { formatDateLong } from "@/lib/formatting";
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
  const graded: Array<{ label: string; sublabel: string; grade: number; at: number }> = [];
  let activeCount = 0;

  for (const cls of classes) {
    for (const assignment of cls.assignments) {
      const submission = assignment.submission;
      const isGraded = submission?.status === "reviewed" && submission.grade !== null;
      if (isGraded && submission) {
        graded.push({
          label: assignment.title,
          sublabel: cls.name,
          grade: submission.grade as number,
          at: submission.submitted_at ? new Date(submission.submitted_at).getTime() : 0,
        });
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
    // "Terakhir" berarti terbaru dikumpulkan, bukan urutan kelas di daftar.
    gradeChart: [...graded]
      .sort((a, b) => b.at - a.at)
      .slice(0, 6)
      .map((g) => ({ label: g.label, sublabel: g.sublabel, value: g.grade })),
  };
}

export default async function StudentPage() {
  const [me, classes] = await Promise.all([getMe(), getStudentClasses()]);
  const overview = deriveOverview(classes);
  // Dihitung per render, bukan sekali saat modul dimuat. Sebagai konstanta
  // modul, tanggalnya membeku pada saat server dinyalakan dan besok masih
  // menampilkan hari kemarin.
  const today = formatDateLong();
  const fullName = me.display_name || me.email;
  const words = fullName.split(" ");
  // "Mahasiswa 01" disapa utuh; menyapa "Mahasiswa" saja terasa seperti sapaan massal.
  const firstName =
    words.length > 1 && /^\d+$/.test(words[words.length - 1]) ? fullName : words[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Selamat datang, ${firstName}`}
        subtitle={`${today} · ${overview.activeCount} tugas menunggu diselesaikan`}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          stackOnMobile
          icon={BookOpen}
          label="Tugas aktif"
          value={overview.activeCount}
        />
        <StatCard
          stackOnMobile
          icon={CheckCircle2}
          label="Tugas selesai"
          value={overview.doneCount}
        />
        <StatCard
          stackOnMobile
          icon={Star}
          label="Rata-rata nilai"
          value={overview.averageGrade ?? "-"}
        />
        <StatCard
          stackOnMobile
          icon={GraduationCap}
          label="Kelas diikuti"
          value={classes.length}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {classes.length === 0 ? (
            <Card className="border-dashed p-10 text-center text-body text-muted-foreground shadow-none">
              Kamu belum bergabung ke kelas mana pun. Minta kode kelas ke dosenmu,
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
                Masukkan kode undangan dari dosenmu.
              </p>
            </div>
            <JoinCodeForm />
          </Card>

          {overview.gradeChart.length > 0 ? (
            <Card className="space-y-1 p-5 shadow-soft">
              <h2 className="font-bold text-foreground">Nilai Tugas Terakhir</h2>
              <p className="text-body-sm text-muted-foreground">
                {overview.gradeChart.length} tugas terbaru yang sudah dinilai
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
