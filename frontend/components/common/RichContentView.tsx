import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";

import { asJSONContent, plainTextToDoc } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

// Harus sama persis dengan konfigurasi StarterKit di RichAnswerEditor.tsx -
// keduanya membaca/menulis dokumen dengan skema yang sama, dan generateHTML
// tidak butuh sisi klien apa pun sehingga aman dipakai di Server Component.
const EXTENSIONS = [
  StarterKit.configure({
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
    heading: { levels: [2, 3] },
  }),
];

interface Props {
  /** rich_content dari Submission. Bisa null untuk submission lama yang
   *  dibuat sebelum field ini ada. */
  content: unknown;
  /** text_answer dari Submission yang sama, dipakai kalau content kosong. */
  fallbackText: string;
  className?: string;
}

/** Tampilan baca-saja dari rich_content, dipakai di layar mahasiswa (jawaban
 *  terkunci) maupun layar detail dosen. */
export function RichContentView({ content, fallbackText, className }: Props) {
  const doc = asJSONContent(content) ?? plainTextToDoc(fallbackText);
  const html = generateHTML(doc, EXTENSIONS);
  return (
    <div
      className={cn("prose-answer", className)}
      // eslint-disable-next-line react/no-danger -- HTML dibangun dari skema
      // ProseMirror tertutup (StarterKit di atas), bukan dari markup bebas.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
