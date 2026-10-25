import type { RichDoc } from "@/lib/types";

const heading = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

/** Kerangka instruksi yang jelas bagi mahasiswa; dosen tinggal mengisi tiap bagian. */
export const INSTRUCTION_TEMPLATE: RichDoc = {
  type: "doc",
  content: [
    heading("Tujuan tugas"),
    paragraph("Apa yang harus dipahami atau dicapai mahasiswa lewat tugas ini."),
    heading("Yang perlu dikerjakan"),
    paragraph("Langkah atau pertanyaan yang harus dijawab, satu per satu."),
    heading("Format dan panjang jawaban"),
    paragraph("Mis. esai 400–600 kata, boleh menyertakan tabel atau gambar pendukung."),
    heading("Kriteria penilaian"),
    paragraph(
      "Apa yang dinilai dan bobotnya, mis. ketepatan konsep, kedalaman analisis, kejelasan.",
    ),
    heading("Bahan pendukung"),
    paragraph("Tempel tautan ke bacaan atau berkas (Google Drive, PDF, situs) di sini."),
  ],
};
