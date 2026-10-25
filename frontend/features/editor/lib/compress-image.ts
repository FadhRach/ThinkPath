/** Gambar jawaban disimpan sebagai data URI di dalam dokumen, jadi harus kecil. */
export const MAX_IMAGES = 5;
const MAX_SIDE = 1280;
/** Panjang data URI maksimal per gambar; server menolak di atas 700.000 karakter. */
const MAX_CHARS = 450_000;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED.includes(file.type);
}

/**
 * Kecilkan gambar (sisi terpanjang ≤ 1280 px) dan simpan sebagai JPEG, menurunkan mutu bertahap
 * sampai muat. Latar transparan diputihkan karena JPEG tidak mengenal transparansi.
 */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) break;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const quality = Math.max(0.5, 0.85 - attempt * 0.07);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_CHARS) {
      bitmap.close();
      return url;
    }
    scale *= 0.8;
  }
  bitmap.close();
  throw new Error("Gambar terlalu besar untuk disisipkan. Pakai gambar yang lebih kecil.");
}
