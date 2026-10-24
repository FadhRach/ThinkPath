"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface LinkDialogProps {
  open: boolean;
  /** Tautan yang sedang disunting (kosong untuk tautan baru). */
  initialHref: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (href: string) => void;
  onRemove: () => void;
}

/** Tambahkan http://, kecuali alamat sudah bersakelar (https:, mailto:). Skema lain ditolak. */
export function normalizeHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return `https://${trimmed}`;
}

export function LinkDialog({
  open,
  initialHref,
  onOpenChange,
  onSubmit,
  onRemove,
}: LinkDialogProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue(initialHref);
  }, [open, initialHref]);

  const href = normalizeHref(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (href) onSubmit(href);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{initialHref ? "Ubah tautan" : "Tambah tautan"}</DialogTitle>
            <DialogDescription>
              Alamat harus diawali http://, https://, atau mailto:. Tanpa awalan, https://
              ditambahkan.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Alamat tautan"
            type="text"
            inputMode="url"
            placeholder="https://contoh.ac.id/artikel"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
          {value.trim() && !href ? (
            <p className="text-sm text-danger">
              Alamat ini tidak diizinkan. Pakai http, https, atau mailto.
            </p>
          ) : null}
          <DialogFooter>
            {initialHref ? (
              <Button type="button" variant="destructive-outline" onClick={onRemove}>
                Hapus tautan
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!href}>
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
