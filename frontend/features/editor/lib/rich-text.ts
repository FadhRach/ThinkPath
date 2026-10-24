import type { RichDoc, RichNode } from "@/lib/types";

/**
 * Teks polos sebuah dokumen, sama dengan `rich_to_plain` di backend (rumus dan gambar tidak
 * dihitung). Dipakai hanya untuk hitungan kata di layar; teks yang dianalisis selalu dari server.
 */
export function richToPlain(doc: RichDoc): string {
  const inline = (node: RichNode): string =>
    node.type === "text" ? (node.text ?? "") : node.type === "hardBreak" ? "\n" : "";

  const lines = (node: RichNode): string[] => {
    const children = node.content ?? [];
    switch (node.type) {
      case "paragraph":
      case "heading":
      case "codeBlock":
        return [children.map(inline).join("")];
      case "tableCell":
      case "tableHeader":
        return [children.flatMap(lines).filter(Boolean).join(" ")];
      case "tableRow":
        return [children.map((cell) => lines(cell)[0] ?? "").join("\t")];
      case "blockMath":
      case "horizontalRule":
        return [];
      default:
        return children.flatMap(lines);
    }
  };

  return (doc.content ?? [])
    .map((block) => lines(block).join("\n"))
    .filter((block) => block.trim() !== "")
    .join("\n\n")
    .trim();
}

/** Teks polos (jawaban lama, atau hasil impor dokumen) menjadi dokumen: satu paragraf per baris. */
export function textToDoc(text: string): RichDoc {
  const paragraphs = text
    .split(/\r?\n/)
    .map<RichNode>((line) =>
      line === ""
        ? { type: "paragraph" }
        : { type: "paragraph", content: [{ type: "text", text: line }] },
    );
  return { type: "doc", content: paragraphs.length ? paragraphs : [{ type: "paragraph" }] };
}

/** Dokumen untuk editor: jawaban kaya bila ada, kalau tidak teks polos (jawaban lama). */
export function docFrom(rich: RichDoc | null | undefined, text: string): RichDoc {
  return rich ?? textToDoc(text);
}
