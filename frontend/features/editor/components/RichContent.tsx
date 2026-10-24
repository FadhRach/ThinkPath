"use client";

import "katex/dist/katex.min.css";
import "@/features/editor/rich-content.css";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo } from "react";

import { createExtensions } from "@/features/editor/lib/extensions";
import type { RichDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Tampilan baca isi jawaban kaya (mahasiswa setelah dikumpulkan, dan dosen). */
export function RichContent({ doc, className }: { doc: RichDoc; className?: string }) {
  const extensions = useMemo(() => createExtensions(), []);
  const editor = useEditor({
    extensions,
    content: doc,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: cn("rich-content", className) } },
  });

  // Dokumen bisa berganti tanpa pemasangan ulang (mis. dosen berpindah submission).
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(doc)) {
      editor.commands.setContent(doc);
    }
  }, [editor, doc]);

  return <EditorContent editor={editor} />;
}
