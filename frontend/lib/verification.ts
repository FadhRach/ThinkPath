import type { VerificationOutcome, VerificationStatus } from "@/lib/types";

export const OUTCOME_LABEL: Record<Exclude<VerificationOutcome, "">, string> = {
  can_explain: "Dapat menjelaskan",
  partial: "Sebagian dapat dijelaskan",
  cannot_explain: "Belum dapat menjelaskan",
  inconclusive: "Belum dapat disimpulkan",
};

/**
 * Keterangan tiap kesimpulan, ditulis untuk dibaca dosen saat memilih.
 *
 * Tidak ada satu pun yang berbunyi "terbukti menyontek". Sistem ini tidak
 * pernah menyimpulkan kecurangan, dan seorang dosen pun tidak menyimpulkannya
 * dari satu percakapan. Yang bisa dinilai adalah kemampuan menjelaskan, dan itu
 * sudah cukup untuk ditindaklanjuti tanpa menuduh.
 */
export const OUTCOME_HINT: Record<Exclude<VerificationOutcome, "">, string> = {
  can_explain: "Menguasai isi dan alasan di balik jawabannya",
  partial: "Paham kerangkanya, ragu pada bagian tertentu",
  cannot_explain: "Kesulitan menjelaskan kembali isinya sendiri",
  inconclusive: "Perlu sesi lanjutan sebelum menyimpulkan",
};

export const OUTCOME_TONE: Record<Exclude<VerificationOutcome, "">, string> = {
  can_explain: "bg-success-soft text-success",
  partial: "bg-warning-soft text-warning",
  cannot_explain: "bg-danger-soft text-danger",
  inconclusive: "bg-muted text-muted-foreground",
};

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  scheduled: "Dijadwalkan",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export function outcomeLabel(outcome: VerificationOutcome): string {
  return outcome ? OUTCOME_LABEL[outcome] : "";
}
