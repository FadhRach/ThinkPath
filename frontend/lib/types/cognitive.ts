import type { AiBand, StudentMini } from "./common";

export type TrendDirection = "naik" | "datar" | "turun" | "belum_cukup_data";

export interface CognitivePoint {
  submission_id: string;
  label: string;
  level: number;
  expected: number;
  /** Tidak dikirim ke mahasiswa: dia melihat perkembangannya, bukan dugaan sistem. */
  ai_band?: AiBand;
  submitted_at: string;
}

export interface CognitiveClassSeries {
  class_id: string;
  class_name: string;
  subject: string;
  /** Rata rata bergerak eksponensial, bukan rata rata biasa. */
  current_level: number | null;
  direction: TrendDirection;
  point_count: number;
  average_target: number | null;
  points: CognitivePoint[];
}

export interface CognitiveProfile {
  student: StudentMini;
  classes: CognitiveClassSeries[];
}

export interface OverviewStudent {
  student_id: string;
  display_name: string;
  /** Rata rata skor AI lintas submission, bukan nilai tertinggi. */
  ai_mean: number;
  high_count: number;
  current_level: number | null;
  average_target: number | null;
  /** current_level dikurangi average_target. Negatif berarti tertinggal. */
  gap: number | null;
  direction: TrendDirection;
  submission_count: number;
}

export interface BloomDistributionBin {
  level: number;
  count: number;
  /** Berapa dari count yang di bawah target tugasnya sendiri. Opsional karena
   *  frontend dan backend di-deploy terpisah; backend lama belum mengirimnya. */
  below_target?: number;
}

export interface CohortTrendPoint {
  label: string;
  title: string;
  level: number;
  expected: number;
}

export interface OverviewClass {
  class_id: string;
  class_name: string;
  subject: string;
  students: OverviewStudent[];
  below_target_count: number;
  high_band_count: number;
  bloom_distribution: BloomDistributionBin[];
  cohort_trend: CohortTrendPoint[];
  /** Rata rata target lintas tugas kelas, bukan lintas mahasiswa. */
  average_target: number | null;
}

export interface TeacherOverview {
  classes: OverviewClass[];
}

export interface OwnProgress {
  classes: CognitiveClassSeries[];
}
