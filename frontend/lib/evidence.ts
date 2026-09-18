import type { AiBand, SubmissionDetail } from "./types";

export interface EvidenceBands {
  processBand: AiBand;
  textBand: AiBand;
  cognitiveBand: AiBand;
}

function bandFromAi(ai?: AiBand | null): AiBand {
  return ai ?? "low";
}

/**
 * Cadangan ketika backend tidak mengirim sinyal forensik proses.
 *
 * Hanya memakai durasi. Jumlah revisi sengaja tidak dipakai: yang tercatat
 * hanya Simpan Revisi setelah jawaban dikumpulkan, bukan penyuntingan saat
 * menulis, dan backend pun sudah berhenti menskornya. Durasi yang tidak
 * terekam juga tidak boleh berubah menjadi tuduhan.
 */
function processBandFor(durationSeconds: number | null): AiBand {
  if (durationSeconds === null) return "low";
  return durationSeconds < 5 * 60 ? "mid" : "low";
}

/**
 * Utamakan sinyal proses hasil hitungan backend.
 *
 * Sebelumnya frontend selalu memakai heuristiknya sendiri, sehingga di satu
 * layar bisa muncul dua penilaian proses yang berbeda: satu di Evidence Strip
 * dan satu lagi di dalam skor AI. Sekarang keduanya berasal dari satu sumber.
 */
function processBandFromDetail(detail: SubmissionDetail): AiBand {
  const signal = detail.analysis?.signal_breakdown?.find(
    (item) => item.key === "process_forensics",
  );
  if (!signal) {
    return processBandFor(detail.duration_seconds);
  }
  if (signal.value >= 0.7) return "high";
  if (signal.value >= 0.4) return "mid";
  return "low";
}

function cognitiveBandFor(
  bloomLevel: number | undefined,
  expected: number | undefined,
): AiBand {
  if (bloomLevel === undefined || expected === undefined) return "low";
  const gap = expected - bloomLevel;
  if (gap >= 2) return "high";
  if (gap >= 1) return "mid";
  return "low";
}

export function bandsForDetail(detail: SubmissionDetail): EvidenceBands {
  return {
    processBand: processBandFromDetail(detail),
    textBand: bandFromAi(detail.analysis?.ai_band),
    cognitiveBand: cognitiveBandFor(
      detail.analysis?.bloom_level,
      detail.assignment.expected_bloom_level,
    ),
  };
}
