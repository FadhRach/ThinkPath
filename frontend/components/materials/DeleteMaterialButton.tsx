"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteMaterial } from "@/lib/mutations";
import { useAction } from "@/lib/use-action";

interface Props {
  materialId: string;
  title: string;
}

export function DeleteMaterialButton({ materialId, title }: Props) {
  const [open, setOpen] = useState(false);
  const { pending, error, run, router } = useAction("Gagal menghapus materi. Coba lagi.");

  async function handleDelete() {
    await run(
      () => deleteMaterial(materialId),
      () => {
        setOpen(false);
        router.refresh();
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={`Hapus materi ${title}`}
        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus materi ini?</DialogTitle>
          <DialogDescription>
            &ldquo;{title}&rdquo; akan hilang dari halaman Materi mahasiswa. Notifikasi
            yang sudah terkirim tidak ditarik kembali.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-body-sm text-danger">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Menghapus..." : "Hapus materi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
