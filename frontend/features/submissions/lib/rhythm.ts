/**
 * Pemisah kalimat ini MENCERMINKAN `_SENTENCE_SPLIT` di backend (`[.!?]+`, lalu strip dan buang
 * yang kosong). Keduanya harus tetap sama: yang ditampilkan harus persis data yang dipakai
 * menghitung skor. Potongan di sini MENYIMPAN tanda baca dan spasi aslinya, supaya dosen membaca
 * tulisan mahasiswa apa adanya.
 */
const SENTENCE_PIECE = /[^.!?]*[.!?]+|[^.!?]+$/g;

export interface SentencePiece {
  /** Posisi awal isi kalimat (setelah spasi pembuka) pada teks utuh. */
  start: number;
  end: number;
  words: number;
}

export interface Rhythm {
  pieces: SentencePiece[];
  /** Jumlah kalimat berisi kata. */
  count: number;
  mean: number;
  shortest: number;
  longest: number;
}

export function analyseRhythm(text: string): Rhythm {
  const pieces: SentencePiece[] = [];
  let cursor = 0;
  for (const raw of text.match(SENTENCE_PIECE) ?? []) {
    const lead = raw.match(/^\s*/)?.[0].length ?? 0;
    const body = raw
      .slice(lead)
      .replace(/^[.!?]+/, "")
      .replace(/[.!?]+$/, "")
      .trim();
    pieces.push({
      start: cursor + lead,
      end: cursor + raw.length,
      words: body ? body.split(/\s+/).filter(Boolean).length : 0,
    });
    cursor += raw.length;
  }
  const lengths = pieces.filter((piece) => piece.words > 0).map((piece) => piece.words);
  const mean = lengths.length ? lengths.reduce((sum, n) => sum + n, 0) / lengths.length : 0;
  return {
    pieces,
    count: lengths.length,
    mean,
    shortest: lengths.length ? Math.min(...lengths) : 0,
    longest: lengths.length ? Math.max(...lengths) : 0,
  };
}

export type RhythmTone = "short" | "long" | null;

/**
 * Hanya kalimat yang jauh dari rata-rata yang diberi warna. Warna memetakan PANJANG kalimat,
 * bukan kecurigaan: tidak ada kalimat yang "terdeteksi AI"; yang diukur sinyal keseragaman adalah
 * sebaran panjang di seluruh teks.
 */
export function rhythmTone(words: number, mean: number): RhythmTone {
  if (words === 0 || mean <= 0) return null;
  const ratio = words / mean;
  if (ratio < 0.6) return "short";
  if (ratio > 1.4) return "long";
  return null;
}
