import type { JSONContent } from "@tiptap/react";

/**
 * Proyeksi teks polos dari dokumen TipTap, untuk dikirim sebagai text_answer.
 *
 * Setiap blok (paragraf, item daftar, heading) diakhiri tanda baca kalimat
 * kalau belum ada. Backend text_features._SENTENCE_SPLIT memecah kalimat
 * murni dari [.!?]+ dan TIDAK memperlakukan baris baru sebagai batas
 * kalimat. Tanpa titik penutup, satu daftar berpoin utuh terbaca sebagai
 * satu kalimat raksasa dan merusak sinyal uniformity (bobot 0.40, terbesar
 * di antara lima sinyal teks) untuk setiap jawaban yang memakai daftar.
 */
export function richContentToPlainText(doc: JSONContent): string {
  const lines: string[] = [];

  // listItem membungkus paragraph anaknya (listItem -> paragraph -> text).
  // Begitu satu baris diambil lewat extractInlineText (yang sudah menelusuri
  // seluruh keturunannya), node itu TIDAK direkursi lagi - kalau tetap
  // direkursi, paragraph di dalamnya akan terekstrak dua kali: sekali lewat
  // "- " di sini, sekali lagi sebagai paragraf polos tanpa prefiks.
  function visit(node: JSONContent) {
    if (node.type === "paragraph" || node.type === "heading") {
      const text = extractInlineText(node).trim();
      if (text) lines.push(ensureTerminalPunctuation(text));
      return;
    }
    if (node.type === "listItem") {
      const text = extractInlineText(node).trim();
      if (text) lines.push(`- ${ensureTerminalPunctuation(text)}`);
      return;
    }
    node.content?.forEach(visit);
  }

  doc.content?.forEach(visit);
  return lines.join("\n\n");
}

function extractInlineText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(extractInlineText).join("");
}

function ensureTerminalPunctuation(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Panjang teks polos, dipakai untuk validasi klien sebelum kirim ke server. */
export function richContentWordCount(doc: JSONContent): number {
  const text = richContentToPlainText(doc).trim();
  return text ? text.split(/\s+/).length : 0;
}

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * Bungkus teks polos jadi dokumen TipTap, satu paragraf per baris kosong.
 *
 * Dipakai untuk mengisi editor dari hasil OCR, dan untuk menampilkan
 * submission lama yang dibuat sebelum rich_content ada (rich_content=None di
 * baris lama, lihat migrasi 0011_submission_origin_rich_content) - tanpa
 * fallback ini, jawaban lama akan tampil kosong padahal text_answer-nya ada.
 */
export function plainTextToDoc(text: string): JSONContent {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paragraphs.length
      ? paragraphs.map((line) => ({
          type: "paragraph" as const,
          content: [{ type: "text" as const, text: line }],
        }))
      : [{ type: "paragraph" }],
  };
}

export function asJSONContent(value: unknown): JSONContent | undefined {
  return typeof value === "object" && value !== null && "type" in value
    ? (value as JSONContent)
    : undefined;
}
