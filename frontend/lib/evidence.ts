import type { AiBand, SubmissionRow, SubmissionDetail } from "./types";

export interface EvidenceBands {
  processBand: AiBand;
  textBand: AiBand;
  cognitiveBand: AiBand;
}

function bandFromAi(ai?: AiBand | null): AiBand {
  return ai ?? "low";
}

function processBandFor(revisionCount: number, durationSeconds: number | null): AiBand {
  const duration = durationSeconds ?? 0;
  if (duration < 5 * 60 && revisionCount <= 1) return "high";
  if (duration < 15 * 60 || revisionCount <= 2) return "mid";
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
    processBand: processBandFor(detail.revision_count, detail.duration_seconds),
    textBand: bandFromAi(detail.analysis?.ai_band),
    cognitiveBand: cognitiveBandFor(
      detail.analysis?.bloom_level,
      detail.assignment.expected_bloom_level,
    ),
  };
}
