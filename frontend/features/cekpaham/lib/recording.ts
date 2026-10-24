// Fungsi murni untuk rekaman dan teks langsung Cek Paham. Sengaja tanpa impor runtime supaya bisa
// diuji langsung oleh `node --test` (lihat tests/cekpaham.test.mjs).

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
