"use client";

import katex from "katex";
import { useEffect, useRef, useState } from "react";

import { FilterPills } from "@/components/shared/FilterPills";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { MathTarget } from "@/features/editor/lib/extensions";

interface MathDialogProps {
  open: boolean;
  /** Rumus yang sedang disunting; null berarti rumus baru. */
  target: MathTarget | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (latex: string, block: boolean) => void;
  onDelete: () => void;
}

const EXAMPLES: Array<[string, string]> = [
  ["Pecahan", "\\frac{a}{b}"],
  ["Pangkat", "x^{2}"],
  ["Akar", "\\sqrt{x}"],
  ["Sigma", "\\sum_{i=1}^{n} x_i"],
  ["Rata-rata", "\\bar{x} = \\frac{1}{n}\\sum x_i"],
];

type Layout = "inline" | "block";

/** Isi rumus LaTeX dengan pratinjau langsung. Rumus yang diklik di tulisan dibuka kembali di sini. */
export function MathDialog({ open, target, onOpenChange, onSubmit, onDelete }: MathDialogProps) {
  const [latex, setLatex] = useState("");
  const [layout, setLayout] = useState<Layout>("inline");

  useEffect(() => {
    if (!open) return;
    setLatex(target?.latex ?? "");
    setLayout(target?.block ? "block" : "inline");
  }, [open, target]);

  // KaTeX menulis ke elemen lewat DOM, bukan HTML mentah, jadi tidak ada sink XSS
  // (CSP aplikasi mengandalkan tidak adanya dangerouslySetInnerHTML).
  const previewRef = useRef<HTMLSpanElement>(null);
  const hasLatex = latex.trim() !== "";
  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    if (hasLatex) {
      katex.render(latex, node, { throwOnError: false, displayMode: layout === "block" });
    } else {
      node.textContent = "";
    }
  }, [latex, layout, hasLatex, open]);

  const editing = target !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah rumus" : "Sisipkan rumus"}</DialogTitle>
          <DialogDescription>
            Tulis dengan format LaTeX. Contoh: x^2 untuk pangkat, \frac&#123;a&#125;&#123;b&#125;
            untuk pecahan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {editing ? null : (
            <FilterPills
              label="Posisi rumus"
              value={layout}
              onChange={setLayout}
              options={[
                { value: "inline", label: "Dalam kalimat" },
                { value: "block", label: "Baris sendiri" },
              ]}
            />
          )}
          <Textarea
            aria-label="Rumus LaTeX"
            rows={3}
            value={latex}
            onChange={(event) => setLatex(event.target.value)}
            placeholder="\frac{a}{b}"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map(([label, value]) => (
              <button
                key={label}
                type="button"
                onClick={() => setLatex((current) => (current ? `${current} ${value}` : value))}
                className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {label}
              </button>
            ))}
          </div>
          <div
            aria-live="polite"
            className="min-h-16 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-center"
          >
            <span ref={previewRef} />
            {hasLatex ? null : (
              <span className="text-sm text-muted-foreground">Pratinjau rumus tampil di sini.</span>
            )}
          </div>
        </div>

        <DialogFooter>
          {editing ? (
            <Button type="button" variant="destructive-outline" onClick={onDelete}>
              Hapus rumus
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            type="button"
            disabled={!latex.trim()}
            onClick={() => onSubmit(latex.trim(), layout === "block")}
          >
            {editing ? "Simpan rumus" : "Sisipkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
