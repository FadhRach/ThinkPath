import { bloomCode, bloomLabel } from "@/features/bloom/lib/bloom";
import { formatDurationSeconds } from "@/lib/formatting";
import type { AiBand, SubmissionDetail } from "@/lib/types";

interface EvidenceBands {
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
  // Jawaban dari dokumen tidak punya jejak mengetik: tidak dinilai, jadi tidak boleh tampak mencurigakan.
  if (detail.is_imported) return "low";
  // Pola pengerjaan hasil backend (bukti tersendiri, tidak masuk skor AI).
  switch (detail.analysis?.process_band) {
    case "attention":
      return "high";
    case "partial":
      return "mid";
    case "normal":
    case "unrecorded":
      return "low";
  }
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

function cognitiveBandFor(bloomLevel: number | undefined, expected: number | undefined): AiBand {
  if (bloomLevel === undefined || expected === undefined) return "low";
  const gap = expected - bloomLevel;
  if (gap >= 2) return "high";
  if (gap >= 1) return "mid";
  return "low";
}

function bandsForDetail(detail: SubmissionDetail): EvidenceBands {
  return {
    processBand: processBandFromDetail(detail),
    textBand: bandFromAi(detail.analysis?.ai_band),
    cognitiveBand: cognitiveBandFor(
      detail.analysis?.bloom_level,
      detail.assignment.expected_bloom_level,
    ),
  };
}

const BAND_DETAIL_COPY: Record<"low" | "mid" | "high", string> = {
  low: "Tidak ada pola gaya yang menonjol.",
  mid: "Beberapa sinyal layak diperhatikan.",
  high: "Beberapa sinyal kuat perlu ditinjau.",
};

/** Tiga baris Ringkasan Bukti (proses, teks, kognitif) lengkap dengan kalimat penjelasnya. */
export function buildEvidenceRows(detail: SubmissionDetail) {
  const bands = bandsForDetail(detail);
  return [
    { label: "Proses", band: bands.processBand, detail: buildProcessSentence(detail) },
    { label: "Teks", band: bands.textBand, detail: buildTextSentence(detail) },
    { label: "Kognitif", band: bands.cognitiveBand, detail: buildCognitiveSentence(detail) },
  ];
}

function buildProcessSentence(detail: SubmissionDetail): string {
  if (detail.is_imported) {
    return "Jawaban diimpor dari dokumen, jadi tidak ada jejak mengetik dan pola proses tidak dinilai. Nilai dari isi dokumennya.";
  }
  const evidence = detail.analysis?.process_evidence;
  if (evidence) {
    // Kalimat dari backend sudah memuat revisi; ditambah penjelasan netral
    // bila pola tiba-sekaligus, supaya tidak terbaca sebagai tuduhan.
    const note =
      detail.analysis?.process_band === "attention"
        ? " Ini bisa terjadi bila jawaban ditulis di aplikasi lain lalu ditempel."
        : "";
    return `${evidence}.${note}`;
  }
  // Revisi di sini berarti Simpan Revisi setelah dikumpulkan, bukan suntingan
  // saat menulis, jadi kalimatnya tidak boleh terbaca "tidak pernah menyunting".
  const revisionPart =
    detail.revision_count === 0
      ? "Dikumpulkan sekali"
      : `Direvisi ${detail.revision_count} kali setelah dikumpulkan`;
  const growth = detail.reasoning_events.some((event) => event.event_type === "progress")
    ? "kurva pertumbuhan kata terekam"
    : "kurva pertumbuhan kata tidak terekam";
  return `${revisionPart}, ${growth}, durasi ${formatDurationSeconds(detail.duration_seconds)}.`;
}

function buildTextSentence(detail: SubmissionDetail): string {
  if (!detail.analysis) return "Sinyal teks belum tersedia. Gunakan Analisis Ulang.";
  return `Skor ${detail.analysis.ai_score} dari 100. ${BAND_DETAIL_COPY[detail.analysis.ai_band]}`;
}

function buildCognitiveSentence(detail: SubmissionDetail): string {
  if (!detail.analysis) return "Estimasi level kognitif belum tersedia.";
  const observed = detail.analysis.bloom_level;
  const expected = detail.assignment.expected_bloom_level;
  const gap = expected - observed;
  const observedText = `${bloomCode(observed)} ${bloomLabel(observed)}`;
  if (gap <= 0) return `${observedText}, memenuhi target ${bloomCode(expected)}.`;
  if (gap === 1) return `${observedText}, satu tingkat di bawah target ${bloomCode(expected)}.`;
  return `${observedText}, ${gap} tingkat di bawah target ${bloomCode(expected)}.`;
}
