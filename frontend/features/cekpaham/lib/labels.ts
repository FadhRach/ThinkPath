import type {
  CekPahamAttemptStatus,
  CekPahamBand,
  CekPahamPhase,
  CekPahamReportReason,
  CekPahamStudentState,
} from "@/lib/types";

export const PHASE_LABEL: Record<CekPahamPhase, string> = {
  upcoming: "Belum dibuka",
  open: "Sedang dibuka",
  closed: "Sudah ditutup",
  cancelled: "Dibatalkan",
};

export const ATTEMPT_STATUS_LABEL: Record<CekPahamAttemptStatus, string> = {
  in_progress: "Sedang dikerjakan",
  processing: "Diproses",
  scored: "Hasil siap",
  processing_failed: "Perlu diproses ulang",
  interrupted: "Terputus",
  voided: "Dibatalkan (coba ulang diberikan)",
};

export const BAND_LABEL: Record<Exclude<CekPahamBand, "">, string> = {
  kuat: "Terlihat paham",
  sebagian: "Paham sebagian",
  lemah: "Perlu ditinjau dosen",
};

export const REPORT_REASON_LABEL: Record<CekPahamReportReason, string> = {
  transcript_mismatch: "Transkrip tidak sesuai ucapan",
  mic_failure: "Mikrofon bermasalah",
  other: "Kendala lain",
};

export const DIMENSION_LABEL: Record<string, string> = {
  accuracy: "Ketepatan konsep",
  consistency: "Konsistensi dengan jawaban tertulis",
  depth: "Kedalaman penjelasan",
  ownership: "Keakraban dengan isi jawaban",
};

export const FLAG_LABEL: Record<string, string> = {
  off_topic: "Tidak menjawab soal",
  reading_style: "Terdengar membaca",
  generic_answer: "Jawaban umum",
  contradicts_written: "Bertentangan dengan jawaban tertulis",
  asr_caveat: "Transkrip diragukan",
  evidence_unverified: "Ada kutipan yang tidak ditemukan di transkrip",
  judge_disagreement: "Dua penilaian berbeda jauh",
  single_run: "Hanya satu penilaian yang berhasil",
  too_short: "Jawaban terlalu singkat",
  no_speech: "Tidak ada ucapan terbaca",
  over_time: "Melebihi batas waktu",
};

/** Pesan untuk mahasiswa per keadaan sesi. Netral: tidak menyebut skor atau penilaian. */
export const STUDENT_STATE_MESSAGE: Record<CekPahamStudentState, string> = {
  in_progress: "Sesimu sedang berjalan.",
  processing: "Jawabanmu sedang diproses. Ini biasanya selesai dalam setengah menit.",
  done: "Jawabanmu sudah terkirim ke dosen.",
  failed:
    "Jawabanmu sudah tersimpan, tetapi pemrosesannya terhambat. Dosen dapat memprosesnya ulang; kamu tidak perlu mengulang.",
  interrupted:
    "Sesimu terputus. Jawabanmu belum lengkap tersimpan. Laporkan kendalanya agar dosen bisa memberimu kesempatan mengulang.",
};

/** Teks bantuan skor untuk dosen. Selalu tampil bersama skor. */
export const UNCALIBRATED_NOTE =
  "Saran AI, belum dikalibrasi. Transkrip suara bisa salah pada ucapan spontan, jadi skor ini tidak boleh menjadi satu-satunya dasar keputusan atau sanksi.";
