import { BLOOM_LABELS } from "@/lib/formatting";

export const BLOOM_LEVELS = [1, 2, 3, 4, 5, 6] as const;

// Label pendek untuk badge/stepper mengikuti istilah kurikulum pada desain.
const BLOOM_SHORT: Record<number, string> = {
  1: "Mengingat",
  2: "Memahami",
  3: "Menerapkan",
  4: "Menganalisis",
  5: "Mengevaluasi",
  6: "Mencipta",
};

export function bloomLabel(level: number): string {
  return BLOOM_LABELS[level] ?? `L${level}`;
}

export function bloomShortLabel(level: number): string {
  return BLOOM_SHORT[level] ?? `L${level}`;
}

export function bloomCode(level: number): string {
  return `L${level}`;
}
