// Fungsi murni untuk Cek Paham. Sengaja tanpa impor lain supaya bisa diuji
// langsung oleh `node --test` (lihat tests/cekpaham.test.mjs).

import type {
  CekPahamAttemptStatus,
  CekPahamBand,
  CekPahamPhase,
  CekPahamReportReason,
  CekPahamRow,
  CekPahamStudentState,
} from "./types";

/** Urutan pilihan format rekaman: webm/opus (Chrome, Firefox), lalu mp4 (Safari iOS). */
const MIME_PREFERENCE = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

/** Format rekaman pertama yang didukung peramban, atau undefined bila tak satu pun. */
export function pickRecordingMime(isSupported: (mime: string) => boolean): string | undefined {
  return MIME_PREFERENCE.find((mime) => isSupported(mime));
}

/** Level suara 0..1 (RMS) dari data domain waktu AnalyserNode: 128 adalah hening mutlak. */
export function rmsLevel(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const centered = (samples[i] - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / samples.length);
}

/** Di bawah ini dianggap tidak ada sinyal sama sekali (mikrofon mati), bukan sekadar sunyi. */
export const DEAD_INPUT_LEVEL = 0.0004;
/** Di atas ini dianggap sedang berbicara. */
export const SPEECH_LEVEL = 0.02;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Sisa detik dihitung dari tenggat SERVER: selisih tenggat dan jam server saat
 * `start`, dikurangi waktu yang sudah berjalan menurut jam monotonik klien.
 * Jam dinding klien tidak dipercaya (bisa salah atau diubah).
 */
export function secondsLeft(deadlineIso: string, serverNowIso: string, elapsedMs: number): number {
  const total = (Date.parse(deadlineIso) - Date.parse(serverNowIso)) / 1000;
  return Math.max(0, Math.ceil(total - elapsedMs / 1000));
}

/** Menempelkan potongan caption tanpa dobel spasi. */
export function appendCaption(current: string, next: string): string {
  const addition = next.trim();
  if (addition === "") return current;
  return current === "" ? addition : `${current} ${addition}`;
}

/**
 * Memasang hasil potongan caption menurut urutan potongan, bukan urutan tiba:
 * permintaan boleh selesai tak berurutan, tetapi teksnya tidak boleh tertukar.
 * `null` = potongan gagal; dilewati supaya tidak menahan yang di belakangnya.
 */
export function commitReady(
  done: Map<number, string | null>,
  next: number,
  text: string,
): { text: string; next: number } {
  let current = text;
  let index = next;
  while (done.has(index)) {
    current = appendCaption(current, done.get(index) ?? "");
    done.delete(index);
    index += 1;
  }
  return { text: current, next: index };
}

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

/** Tiga angka ringkas di atas daftar Cek Paham dosen. */
export function queueStats(rows: CekPahamRow[]) {
  return {
    // Yang dibatalkan tidak lagi ditunggu.
    waiting: rows.filter((row) => row.status === "active" && row.attempt === null).length,
    scored: rows.filter((row) => row.attempt?.status === "scored").length,
    openReports: rows.reduce((total, row) => total + (row.attempt?.open_reports ?? 0), 0),
  };
}
