"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Sigma,
  SquareCode,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ToolbarButton } from "@/features/editor/components/ToolbarButton";
import { useScrollEdges } from "@/features/editor/components/useScrollEdges";

interface EditorToolbarProps {
  editor: Editor;
  disabled?: boolean;
  onMath: () => void;
  onLink: () => void;
  onImage: () => void;
  /** Tombol tambahan di ujung kanan (mis. impor dokumen). */
  extra?: ReactNode;
}

/** Tepi toolbar yang memudar plus panah, menandai masih ada tombol di luar layar. */
function ScrollCue({
  side,
  visible,
  onClick,
}: {
  side: "start" | "end";
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;
  const Icon = side === "start" ? ChevronLeft : ChevronRight;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 flex w-10 items-center",
        side === "start"
          ? "left-0 justify-start bg-gradient-to-r from-card to-transparent"
          : "right-0 justify-end bg-gradient-to-l from-card to-transparent",
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className="pointer-events-auto grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;
}

/** Toolbar format: teks, daftar, blok, dan sisipan (tabel, rumus, tautan, gambar). */
export function EditorToolbar({
  editor,
  disabled,
  onMath,
  onLink,
  onImage,
  extra,
}: EditorToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      codeBlock: current.isActive("codeBlock"),
      link: current.isActive("link"),
      table: current.isActive("table"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const { ref: scroller, edges, scrollBy } = useScrollEdges<HTMLDivElement>();

  const marks: Array<[LucideIcon, string, boolean, () => void]> = [
    [Bold, "Tebal (Ctrl+B)", state.bold, () => chain().toggleBold().run()],
    [Italic, "Miring (Ctrl+I)", state.italic, () => chain().toggleItalic().run()],
    [Underline, "Garis bawah (Ctrl+U)", state.underline, () => chain().toggleUnderline().run()],
    [Strikethrough, "Coret", state.strike, () => chain().toggleStrike().run()],
    [Code, "Kode dalam baris", state.code, () => chain().toggleCode().run()],
  ];
  const blocks: Array<[LucideIcon, string, boolean, () => void]> = [
    [Heading2, "Judul bagian", state.h2, () => chain().toggleHeading({ level: 2 }).run()],
    [Heading3, "Subjudul", state.h3, () => chain().toggleHeading({ level: 3 }).run()],
    [List, "Daftar berpoin", state.bullet, () => chain().toggleBulletList().run()],
    [ListOrdered, "Daftar bernomor", state.ordered, () => chain().toggleOrderedList().run()],
    [Quote, "Kutipan", state.quote, () => chain().toggleBlockquote().run()],
    [SquareCode, "Blok kode", state.codeBlock, () => chain().toggleCodeBlock().run()],
  ];

  return (
    <div className="border-b border-border bg-card/95 backdrop-blur">
      <div className="relative">
        <div
          ref={scroller}
          role="toolbar"
          aria-label="Format tulisan"
          className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ToolbarButton
            icon={Undo2}
            label="Urungkan (Ctrl+Z)"
            disabled={disabled || !state.canUndo}
            onClick={() => chain().undo().run()}
          />
          <ToolbarButton
            icon={Redo2}
            label="Ulangi (Ctrl+Shift+Z)"
            disabled={disabled || !state.canRedo}
            onClick={() => chain().redo().run()}
          />
          <Divider />
          {marks.map(([icon, label, active, run]) => (
            <ToolbarButton
              key={label}
              icon={icon}
              label={label}
              active={active}
              disabled={disabled}
              onClick={run}
            />
          ))}
          <Divider />
          {blocks.map(([icon, label, active, run]) => (
            <ToolbarButton
              key={label}
              icon={icon}
              label={label}
              active={active}
              disabled={disabled}
              onClick={run}
            />
          ))}
          <Divider />
          <ToolbarButton
            icon={Table2}
            label="Sisipkan tabel"
            disabled={disabled}
            onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          />
          <ToolbarButton
            icon={Sigma}
            label="Sisipkan rumus (LaTeX)"
            disabled={disabled}
            onClick={onMath}
          />
          <ToolbarButton
            icon={Link2}
            label="Tautan"
            active={state.link}
            disabled={disabled}
            onClick={onLink}
          />
          <ToolbarButton
            icon={ImagePlus}
            label="Sisipkan gambar"
            disabled={disabled}
            onClick={onImage}
          />
          <ToolbarButton
            icon={Minus}
            label="Garis pemisah"
            disabled={disabled}
            onClick={() => chain().setHorizontalRule().run()}
          />
          {extra ? (
            <>
              <Divider />
              {extra}
            </>
          ) : null}
        </div>
        <ScrollCue side="start" visible={edges.start} onClick={() => scrollBy(-1)} />
        <ScrollCue side="end" visible={edges.end} onClick={() => scrollBy(1)} />
      </div>

      {state.table && !disabled ? (
        <div
          role="toolbar"
          aria-label="Ubah tabel"
          className="flex flex-wrap items-center gap-1 border-t border-border bg-muted/50 px-3 py-1.5 text-xs"
        >
          <span className="mr-1 font-semibold text-muted-foreground">Tabel:</span>
          {(
            [
              ["Baris di bawah", () => chain().addRowAfter().run()],
              ["Kolom di kanan", () => chain().addColumnAfter().run()],
              ["Hapus baris", () => chain().deleteRow().run()],
              ["Hapus kolom", () => chain().deleteColumn().run()],
              ["Judul baris pertama", () => chain().toggleHeaderRow().run()],
            ] as Array<[string, () => void]>
          ).map(([label, run]) => (
            <button
              key={label}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
              className="rounded-md border border-border bg-card px-2 py-1 font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => chain().deleteTable().run()}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-medium text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" /> Hapus tabel
          </button>
        </div>
      ) : null}
    </div>
  );
}
