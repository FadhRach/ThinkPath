import { bloomShortLabel } from "@/lib/bloom";
import type {
  BloomDistributionBin,
  CognitiveClassSeries,
  TrendDirection,
} from "@/lib/types";

export const TREND_LABEL: Record<TrendDirection, string> = {
  naik: "Menaik",
  datar: "Mendatar",
  turun: "Menurun",
  belum_cukup_data: "Belum cukup data",
};

export const TREND_TONE: Record<TrendDirection, string> = {
  naik: "bg-success-soft text-success",
  datar: "bg-muted text-muted-foreground",
  turun: "bg-warning-soft text-warning",
  belum_cukup_data: "bg-muted text-muted-foreground",
};

/**
 * Selisih level saat ini terhadap target dosen.
 *
 * Angka negatif berarti mahasiswa berada di bawah tuntutan tugas. Ini yang
 * ingin dilihat lebih dulu oleh dosen, bukan skor AI. Mahasiswa yang jujur
 * tetapi mandek di L1 adalah masalah pengajaran yang nyata, sementara skor AI
 * tinggi baru sebatas dugaan yang masih harus diverifikasi.
 */
export function gapToTarget(series: CognitiveClassSeries): number | null {
  if (series.current_level == null || series.average_target == null) return null;
  return Math.round((series.current_level - series.average_target) * 100) / 100;
}

/**
 * Kalimat yang menerjemahkan angka menjadi tindakan.
 *
 * Sengaja tidak pernah menyebut menyontek. Modul ini hanya membaca level Bloom,
 * yang menurut desain tidak boleh tahu apa pun tentang skor AI.
 */
export function trendNarrative(series: CognitiveClassSeries): string {
  const gap = gapToTarget(series);

  if (series.direction === "belum_cukup_data") {
    return `Baru ${series.point_count} tugas dianalisis di kelas ini. Tren belum bisa disimpulkan sebelum ada minimal tiga titik.`;
  }

  if (gap != null && gap <= -1) {
    if (series.direction === "naik") {
      return "Masih di bawah target, tetapi arahnya membaik. Pertahankan jenis tugas yang memicu kenaikan ini.";
    }
    return "Bertahan di bawah target tugas. Ini celah pemahaman, bukan indikasi kecurangan, dan biasanya terjawab dengan pertanyaan yang menuntut alasan, bukan definisi.";
  }

  if (series.direction === "turun") {
    return "Level penalaran menurun pada tugas-tugas terakhir. Layak ditanyakan langsung sebelum diambil kesimpulan.";
  }

  if (series.direction === "naik") {
    return "Penalaran menaik secara konsisten dan sudah memenuhi target tugas.";
  }

  return "Stabil di sekitar target tugas.";
}

/** Ubah deret menjadi bentuk yang dimengerti BloomTrendChart. */
export function toChartPoints(series: CognitiveClassSeries) {
  return series.points.map((point, index) => ({
    label: `T${index + 1}`,
    level: point.level,
  }));
}

/**
 * Keterangan singkat untuk histogram sebaran Bloom.
 *
 * Sengaja tinggal di modul biasa, bukan di berkas komponen grafik yang bertanda
 * "use client". Server component yang mengimpor fungsi dari modul klien tidak
 * menerima fungsinya, melainkan referensi klien, dan pemanggilannya gagal saat
 * render di server.
 */
export function bloomAxisCaption(bins: BloomDistributionBin[]): string {
  const top = [...bins].sort((a, b) => b.count - a.count)[0];
  if (!top || top.count === 0) return "";
  return `Paling banyak di L${top.level} ${bloomShortLabel(top.level)}`;
}
