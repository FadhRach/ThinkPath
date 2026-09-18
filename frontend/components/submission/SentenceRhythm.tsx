import { cn } from "@/lib/utils";

/**
 * Pemisah kalimat ini MENCERMINKAN `_SENTENCE_SPLIT` di
 * backend/academics/text_features.py (`[.!?]+`, lalu strip dan buang yang
 * kosong). Keduanya harus tetap sama, karena yang ditampilkan di sini harus
 * persis data yang dipakai menghitung skor. Kalau salah satu diubah, yang lain
 * wajib menyusul.
 *
 * Bedanya hanya satu: potongan di sini MENYIMPAN tanda baca dan spasi aslinya.
 * Dulu kalimat disambung ulang dengan ". ", sehingga tanda tanya berubah jadi
 * titik dan paragraf lenyap. Dosen membaca teks yang bukan tulisan mahasiswa.
 */
const SENTENCE_PIECE = /[^.!?]*[.!?]+|[^.!?]+$/g;

interface Piece {
  /** Spasi atau baris baru sebelum kalimat, dibiarkan di luar sorotan. */
  lead: string;
  text: string;
  words: number;
}

function toPieces(text: string): Piece[] {
  return (text.match(SENTENCE_PIECE) ?? []).map((raw) => {
    const lead = raw.match(/^\s*/)?.[0] ?? "";
    const content = raw.slice(lead.length);
    const body = content.replace(/^[.!?]+/, "").replace(/[.!?]+$/, "").trim();
    return {
      lead,
      text: content,
      words: body ? body.split(/\s+/).filter(Boolean).length : 0,
    };
  });
}

type Tone = "short" | "long" | null;

/**
 * Hanya kalimat yang jauh dari rata-rata yang disorot.
 *
 * Warna memetakan PANJANG kalimat, bukan tingkat kecurigaan: tidak ada satu
 * kalimat pun yang "terdeteksi AI", dan yang diukur sinyal keseragaman adalah
 * sebaran panjang pada seluruh teks. Dulu setiap kalimat diberi latar, dan
 * jawaban berubah menjadi dinding hijau yang sulit dibaca. Sekarang teks yang
 * ritmenya seragam nyaris tanpa sorotan, dan teks yang bervariasi belang.
 */
function toneFor(words: number, mean: number): Tone {
  if (words === 0 || mean <= 0) return null;
  const ratio = words / mean;
  if (ratio < 0.6) return "short";
  if (ratio > 1.4) return "long";
  return null;
}

const TONE_CLASS: Record<Exclude<Tone, null>, string> = {
  short: "bg-muted",
  long: "bg-secondary/60",
};

export function SentenceRhythm({ text }: { text: string }) {
  const pieces = toPieces(text);
  const sentences = pieces.filter((piece) => piece.words > 0);

  if (sentences.length < 3) {
    return (
      <div className="space-y-3">
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{text}</p>
        <p className="text-caption text-muted-foreground">
          Jawaban terlalu pendek untuk membaca ritme kalimat.
        </p>
      </div>
    );
  }

  const lengths = sentences.map((s) => s.words);
  const mean = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  const tallest = Math.max(longest, 1);

  return (
    <div className="space-y-4">
      <p className="text-body-sm text-muted-foreground">
        {sentences.length} kalimat, rata-rata {mean.toFixed(0)} kata, terpendek{" "}
        {shortest} dan terpanjang {longest}.
      </p>

      {/* Bilah ritme: satu batang per kalimat, tingginya panjang kalimat.
          Bentuk rata berarti seragam, bergerigi berarti bervariasi. */}
      <div className="flex h-14 items-end gap-0.5" aria-hidden="true">
        {sentences.map((sentence, index) => (
          <span
            key={index}
            className="flex-1 rounded-t bg-primary/60"
            style={{ height: `${Math.max(6, (sentence.words / tallest) * 100)}%` }}
            title={`Kalimat ${index + 1}: ${sentence.words} kata`}
          />
        ))}
      </div>

      <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
        {pieces.map((piece, index) => {
          const tone = toneFor(piece.words, mean);
          return (
            <span key={index}>
              {piece.lead}
              <span className={cn(tone && "rounded px-0.5", tone && TONE_CLASS[tone])}>
                {piece.text}
              </span>
            </span>
          );
        })}
      </p>

      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded bg-muted" aria-hidden="true" />
            Jauh lebih pendek dari rata-rata
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded bg-secondary/60" aria-hidden="true" />
            Jauh lebih panjang dari rata-rata
          </span>
        </div>
        <p className="text-caption text-muted-foreground">
          Sorotan menandai panjang kalimat, bukan dugaan AI pada kalimat itu. Yang
          diukur adalah sebaran panjang pada seluruh jawaban: teks yang nyaris
          tanpa sorotan ritmenya seragam. Itu layak ditanyakan, tetapi menulis
          rapi bukan pelanggaran.
        </p>
      </div>
    </div>
  );
}
