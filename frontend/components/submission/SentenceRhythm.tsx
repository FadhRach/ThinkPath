import { cn } from "@/lib/utils";

/**
 * Pemisah kalimat ini MENCERMINKAN `_SENTENCE_SPLIT` di
 * backend/academics/text_features.py. Keduanya harus tetap sama, karena yang
 * ditampilkan di sini harus persis data yang dipakai menghitung skor. Kalau
 * salah satu diubah, yang lain wajib menyusul.
 */
const SENTENCE_SPLIT = /[.!?]+/;

interface Piece {
  text: string;
  words: number;
}

function toSentences(text: string): Piece[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ text: part, words: part.split(/\s+/).filter(Boolean).length }));
}

/**
 * Warna memetakan PANJANG kalimat, bukan tingkat kecurigaan.
 *
 * Ini pembedaan yang menentukan. Tidak ada satu kalimat pun yang "terdeteksi
 * AI", dan menyorotnya seolah begitu berarti menjanjikan bukti tingkat kalimat
 * yang tidak kita punya. Yang benar benar diukur sinyal keseragaman adalah
 * sebaran panjang kalimat pada seluruh teks. Karena itu yang diwarnai
 * panjangnya saja, sebagai fakta, dan dosen sendiri yang membaca polanya:
 * satu rona rata berarti ritmenya seragam, belang berarti bervariasi.
 */
function tone(words: number, mean: number): string {
  const ratio = mean > 0 ? words / mean : 1;
  if (ratio < 0.6) return "bg-secondary/30";
  if (ratio < 0.85) return "bg-secondary/50";
  if (ratio <= 1.15) return "bg-secondary/70";
  if (ratio <= 1.4) return "bg-secondary/50";
  return "bg-secondary/30";
}

export function SentenceRhythm({ text }: { text: string }) {
  const sentences = toSentences(text);

  if (sentences.length < 3) {
    return (
      <p className="text-body-sm text-muted-foreground">
        Jawaban terlalu pendek untuk membaca ritme kalimat.
      </p>
    );
  }

  const lengths = sentences.map((s) => s.words);
  const mean = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  const tallest = Math.max(longest, 1);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-body-sm text-muted-foreground">
          {sentences.length} kalimat, rata-rata {mean.toFixed(0)} kata, terpendek{" "}
          {shortest} dan terpanjang {longest}.
        </p>
      </div>

      {/* Bilah ritme: satu batang per kalimat, tingginya panjang kalimat.
          Bentuk rata berarti seragam, bergerigi berarti bervariasi. */}
      <div className="flex h-16 items-end gap-0.5" aria-hidden="true">
        {sentences.map((sentence, index) => (
          <span
            key={index}
            className="flex-1 rounded-t bg-primary/70"
            style={{ height: `${Math.max(6, (sentence.words / tallest) * 100)}%` }}
            title={`Kalimat ${index + 1}: ${sentence.words} kata`}
          />
        ))}
      </div>

      <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
        {sentences.map((sentence, index) => (
          <span key={index} className={cn("rounded px-0.5", tone(sentence.words, mean))}>
            {sentence.text}
            {index < sentences.length - 1 ? ". " : "."}
          </span>
        ))}
      </p>

      <p className="text-caption text-muted-foreground">
        Warna menandai panjang tiap kalimat terhadap rata-rata, bukan dugaan AI
        pada kalimat itu. Tidak ada kalimat yang dinilai sendiri sendiri: yang
        diukur sebaran panjangnya pada seluruh jawaban. Ritme yang sangat rata
        layak ditanyakan, tetapi menulis rapi bukan pelanggaran.
      </p>
    </div>
  );
}
