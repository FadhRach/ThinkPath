import type { AnyExtension } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { Mathematics } from "@tiptap/extension-mathematics";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";

import { TabIndent } from "@/features/editor/lib/tab-indent";

export interface MathTarget {
  latex: string;
  /** Posisi simpul di dokumen, untuk memperbarui rumus yang diklik. */
  pos: number;
  block: boolean;
}

interface ExtensionOptions {
  placeholder?: string;
  /** Hanya editor yang bisa menyunting; tampilan baca tidak perlu klik rumus. */
  onMathClick?: (target: MathTarget) => void;
}

/**
 * Skema editor, dipakai bersama oleh editor dan tampilan baca. Setiap simpul dan tanda di sini
 * harus ada juga di daftar putih `apps/academics/services/rich_text.py`; server menolak sisanya.
 */
export function createExtensions({
  placeholder,
  onMathClick,
}: ExtensionOptions = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    TableKit.configure({ table: { resizable: false } }),
    Image.configure({ allowBase64: true }),
    Mathematics.configure({
      katexOptions: { throwOnError: false },
      inlineOptions: {
        onClick: (node, pos) => onMathClick?.({ latex: node.attrs.latex, pos, block: false }),
      },
      blockOptions: {
        onClick: (node, pos) => onMathClick?.({ latex: node.attrs.latex, pos, block: true }),
      },
    }),
    TabIndent,
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}
