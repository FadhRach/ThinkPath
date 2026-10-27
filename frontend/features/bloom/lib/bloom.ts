export const BLOOM_LEVELS = [1, 2, 3, 4, 5, 6] as const;

// Label panjang untuk keterangan lengkap (rumusan taksonomi asli).
const BLOOM_LABELS: Record<number, string> = {
  1: "Mengingat",
  2: "Memahami",
  3: "Menerapkan",
  4: "Menganalisis",
  5: "Mengevaluasi",
  6: "Mencipta",
};

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

/** Penjelasan singkat tiap level untuk memilih target tugas, dengan kata kerja khasnya. */
export const BLOOM_HINT: Record<number, string> = {
  1: "Mengingat fakta: menyebutkan, mendefinisikan, mendaftar.",
  2: "Memahami makna: menjelaskan, merangkum, memberi contoh.",
  3: "Memakai konsep pada kasus: menerapkan, menghitung, mengerjakan.",
  4: "Menguraikan dan membandingkan: menganalisis, membedakan, mengaitkan sebab-akibat.",
  5: "Menilai dengan alasan: mengevaluasi, mengkritik, membela pilihan.",
  6: "Menghasilkan sesuatu yang baru: merancang, menyusun, mengusulkan.",
};
