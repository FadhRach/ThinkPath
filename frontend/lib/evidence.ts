import type { AiBand, SubmissionRow, SubmissionDetail } from "./types";

export interface EvidenceBands {
  processBand: AiBand;
  textBand: AiBand;
  cognitiveBand: AiBand;
}

function bandFromAi(ai?: AiBand | null): AiBand {
  return ai ?? "low";
}

/**
 * Cadangan ketika backend belum mengirim sinyal forensik proses, misalnya pada
 * baris tabel yang hanya memuat ringkasan analisis.
 */
function processBandFor(revisionCount: number, durationSeconds: number | null): AiBand {
  const duration = durationSeconds ?? 0;
  if (duration < 5 * 60 && revisionCount <= 1) return "high";
  if (duration < 15 * 60 || revisionCount <= 2) return "mid";
  return "low";
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
    return processBandFor(detail.revision_count, detail.duration_seconds);
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

export function bandsForRow(
  row: SubmissionRow,
  expectedBloomLevel: number,
): EvidenceBands {
  return {
    processBand: processBandFor(row.revision_count, row.duration_seconds),
    textBand: bandFromAi(row.analysis?.ai_band),
    cognitiveBand: cognitiveBandFor(row.analysis?.bloom_level, expectedBloomLevel),
  };
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
