"use client";

import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, List, ListOrdered } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { PasteEvent } from "@/lib/mutations";
import { EMPTY_DOC, richContentToPlainText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

export interface RichAnswerEditorHandle {
  getRichContent: () => JSONContent;
  getPlainText: () => string;
  getPasteEvents: () => PasteEvent[];
  /** Mengisi editor dari hasil ekstraksi dokumen tanpa terhitung sebagai
   *  tempelan - lihat komentar di SubmitAnswerForm.tsx tentang kenapa impor
   *  dokumen dan tempel manual harus dibedakan. */
  setImportedContent: (doc: JSONContent) => void;
}

interface Props {
  initialContent?: JSONContent;
  disabled?: boolean;
  className?: string;
  /** Dipanggil setiap dokumen berubah - lewat ketikan, tempel, atau impor. */
  onUpdate?: (plainText: string) => void;
}

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn("h-8 w-8", active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 px-3 py-2">
      <ToolbarButton
        label="Tebal"
        active={editor.isActive("bold")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Judul level 2"
        active={editor.isActive("heading", { level: 2 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Judul level 3"
        active={editor.isActive("heading", { level: 3 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Daftar berpoin"
        active={editor.isActive("bulletList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Daftar bernomor"
        active={editor.isActive("orderedList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export const RichAnswerEditor = forwardRef<RichAnswerEditorHandle, Props>(
  function RichAnswerEditor({ initialContent, disabled, className, onUpdate }, ref) {
    // Disimpan di ref, bukan state: tempel bisa terjadi berkali kali dan
    // tidak ada bagian dari toolbar/tampilan yang perlu re-render karenanya,
    // persis alasan progressRef di SubmitAnswerForm.tsx juga sebuah ref.
    const pasteEventsRef = useRef<PasteEvent[]>([]);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
          heading: { levels: [2, 3] },
        }),
      ],
      content: initialContent ?? EMPTY_DOC,
      editable: !disabled,
      editorProps: {
        attributes: {
          class: "prose-answer min-h-[240px] px-5 py-4 text-body-lg focus:outline-none",
        },
        handlePaste: (_view, event) => {
          const text = event.clipboardData?.getData("text/plain") ?? "";
          if (text.length > 0) {
            pasteEventsRef.current.push({
              at: new Date().toISOString(),
              char_count: text.length,
            });
          }
          // false: biarkan TipTap tetap menyisipkan kontennya seperti biasa,
          // skema editor sendiri yang menyaring markup asing ke node/mark
          // yang dikenal ekstensi di atas.
          return false;
        },
      },
      // onCreate menutup celah yang dibuka immediatelyRender=false: editor
      // baru siap setelah render pertama, jadi konten awal (mode revisi)
      // tidak pernah lewat onUpdate (TipTap tidak menganggap "content" awal
      // sebagai perubahan). Tanpa onCreate, induk (SubmitAnswerForm) tidak
      // akan pernah tahu jumlah kata awal sampai pengguna mengetik sesuatu.
      onCreate: ({ editor: created }) => {
        onUpdate?.(richContentToPlainText(created.getJSON()));
      },
      onUpdate: ({ editor: current }) => {
        onUpdate?.(richContentToPlainText(current.getJSON()));
      },
      immediatelyRender: false,
    });

    useImperativeHandle(
      ref,
      () => ({
        getRichContent: () => editor?.getJSON() ?? EMPTY_DOC,
        getPlainText: () => richContentToPlainText(editor?.getJSON() ?? EMPTY_DOC),
        getPasteEvents: () => pasteEventsRef.current,
        setImportedContent: (doc: JSONContent) => {
          // emitUpdate=true: parent (SubmitAnswerForm) melacak jumlah kata
          // lewat prop onUpdate, dan itu tidak berjalan otomatis untuk
          // setContent terprogram (default TipTap: emitUpdate=false).
          editor?.commands.setContent(doc, true);
        },
      }),
      [editor],
    );

    if (!editor) return null;

    return (
      <div className={cn("flex flex-col", className)}>
        <Toolbar editor={editor} disabled={disabled} />
        <EditorContent editor={editor} />
      </div>
    );
  },
);
