/**
 * Offset sorotan dari backend dihitung per code point (indeks string Python), sedangkan
 * `String.slice` di JavaScript per unit UTF-16. Emoji dan karakter lain di luar BMP memakan dua
 * unit, jadi tanpa pemetaan ini setiap sorotan sesudahnya bergeser.
 *
 * Offset di luar panjang teks tetap di luar (selisihnya dipertahankan), supaya pemeriksaan
 * `end > text.length` di pemanggil tetap menyaring span yang tidak cocok dengan teksnya.
 */
export function toUtf16Spans<T extends { start: number; end: number }>(
  text: string,
  spans: T[],
): T[] {
  // units[i] = posisi UTF-16 dari code point ke-i; elemen terakhir = text.length.
  const units: number[] = [];
  let unit = 0;
  for (const char of text) {
    units.push(unit);
    unit += char.length;
  }
  units.push(unit);
  const last = units.length - 1;
  const map = (offset: number) =>
    offset <= last ? units[Math.max(offset, 0)] : text.length + (offset - last);
  return spans.map((span) => ({ ...span, start: map(span.start), end: map(span.end) }));
}
