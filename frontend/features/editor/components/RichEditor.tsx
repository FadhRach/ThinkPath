"use client";

import "katex/dist/katex.min.css";
import "@/features/editor/rich-content.css";

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";

import { EditorToolbar } from "@/features/editor/components/EditorToolbar";
import { LinkDialog } from "@/features/editor/components/LinkDialog";
import { MathDialog } from "@/features/editor/components/MathDialog";
import { compressImage, isAcceptedImage, MAX_IMAGES } from "@/features/editor/lib/compress-image";
import { createExtensions, type MathTarget } from "@/features/editor/lib/extensions";
import { notify } from "@/lib/notify";
import type { RichDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface RichEditorProps {
  /** Dokumen awal. Diabaikan setelah editor terpasang; ganti isi lewat `editorRef`. */
  initial: RichDoc;
  onChange: (doc: RichDoc) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Tombol tambahan di toolbar (mis. impor dokumen). */
  toolbarExtra?: ReactNode;
  /** Diisi dengan instans editor, supaya induk bisa mengganti isinya (impor dokumen). */
  editorRef?: MutableRefObject<Editor | null>;
}

function imageCount(editor: Editor): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "image") count += 1;
  });
  return count;
}

/**
 * Editor tulisan kaya: tebal/miring/garis bawah, judul, daftar, tabel, kode, rumus LaTeX, tautan,
 * dan gambar. Tab menjorok; Esc lalu Tab keluar dari kotak. Seluruh isi disimpan sebagai
 * dokumen JSON; server membersihkannya dan menurunkan teks polos untuk analisis.
 */
export function RichEditor({
  initial,
  onChange,
  placeholder = "Mulai menulis jawabanmu di sini…",
  disabled = false,
  ariaLabel = "Jawaban",
  toolbarExtra,
  editorRef,
}: RichEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [mathOpen, setMathOpen] = useState(false);
  const [mathTarget, setMathTarget] = useState<MathTarget | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");

  const openMath = useCallback((target: MathTarget | null) => {
    setMathTarget(target);
    setMathOpen(true);
  }, []);

  const extensions = useMemo(
    () => createExtensions({ placeholder, onMathClick: (target) => openMath(target) }),
    [placeholder, openMath],
  );

  const insertImageFile = useCallback(async (editor: Editor, file: File) => {
    if (!isAcceptedImage(file)) {
      notify.error("Gambar harus berformat PNG, JPEG, WebP, atau GIF.");
      return;
    }
    if (imageCount(editor) >= MAX_IMAGES) {
      notify.error(`Maksimal ${MAX_IMAGES} gambar dalam satu jawaban.`);
      return;
    }
    try {
      const src = await compressImage(file);
      // Disisipkan setelah seleksi: setImage menimpa gambar yang sedang terpilih, dan gambar
      // yang baru disisipkan selalu dalam keadaan terpilih.
      editor
        .chain()
        .focus()
        .insertContentAt(editor.state.selection.to, {
          type: "image",
          attrs: { src, alt: file.name.replace(/\.[^.]+$/, "") },
        })
        .run();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Gambar tidak bisa disisipkan.");
    }
  }, []);

  const editor = useEditor({
    extensions,
    content: initial,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-content rich-editable min-h-72 px-5 py-4 sm:px-6",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
      },
      // Gambar yang ditempel dari papan klip (tangkapan layar) ikut dikecilkan lalu disisipkan.
      handlePaste: (view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find(isAcceptedImage);
        if (!file || !editorRef?.current) return false;
        void insertImageFile(editorRef.current, file);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as RichDoc),
  });

  if (editorRef) editorRef.current = editor;

  // `editable` di opsi useEditor hanya dibaca saat pemasangan; penguncian karena tenggat lewat
  // datang belakangan, jadi diterapkan ke instans yang sudah hidup.
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  function submitMath(latex: string, block: boolean) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (mathTarget) {
      (mathTarget.block
        ? chain.updateBlockMath({ latex, pos: mathTarget.pos })
        : chain.updateInlineMath({ latex, pos: mathTarget.pos })
      ).run();
    } else {
      (block ? chain.insertBlockMath({ latex }) : chain.insertInlineMath({ latex })).run();
    }
    setMathOpen(false);
  }

  function deleteMath() {
    if (!editor || !mathTarget) return;
    const chain = editor.chain().focus();
    (mathTarget.block
      ? chain.deleteBlockMath({ pos: mathTarget.pos })
      : chain.deleteInlineMath({ pos: mathTarget.pos })
    ).run();
    setMathOpen(false);
  }

  function openLink() {
    if (!editor) return;
    setLinkHref((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  }

  function submitLink(href: string) {
    if (!editor) return;
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain
        .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      chain.setLink({ href }).run();
    }
    setLinkOpen(false);
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }

  return (
    <div className={cn("bg-card", disabled && "opacity-70")}>
      {editor ? (
        <div className="sticky top-16 z-10">
          <EditorToolbar
            editor={editor}
            disabled={disabled}
            onMath={() => openMath(null)}
            onLink={openLink}
            onImage={() => fileInput.current?.click()}
            extra={toolbarExtra}
          />
        </div>
      ) : (
        <div className="h-11 border-b border-border" aria-hidden="true" />
      )}
      <EditorContent editor={editor} />

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-label="Pilih gambar untuk disisipkan"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && editor) void insertImageFile(editor, file);
        }}
      />
      <MathDialog
        open={mathOpen}
        target={mathTarget}
        onOpenChange={setMathOpen}
        onSubmit={submitMath}
        onDelete={deleteMath}
      />
      <LinkDialog
        open={linkOpen}
        initialHref={linkHref}
        onOpenChange={setLinkOpen}
        onSubmit={submitLink}
        onRemove={removeLink}
      />
    </div>
  );
}
