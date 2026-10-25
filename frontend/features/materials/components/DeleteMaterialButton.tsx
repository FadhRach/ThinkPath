"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { deleteMaterial } from "@/lib/mutations";

interface DeleteMaterialButtonProps {
  materialId: string;
  title: string;
}

export function DeleteMaterialButton({ materialId, title }: DeleteMaterialButtonProps) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction("Gagal menghapus materi. Coba lagi.", {
    successMessage: "Materi dihapus.",
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Hapus materi ${title}`}
        className="text-muted-foreground hover:bg-danger-soft hover:text-danger"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title="Hapus materi ini?"
        description={`"${title}" akan hilang dari halaman Materi mahasiswa. Notifikasi yang sudah terkirim tidak ditarik kembali.`}
        confirmLabel="Hapus materi"
        pending={pending}
        onConfirm={async () => {
          const { ok } = await run(() => deleteMaterial(materialId));
          if (ok) setOpen(false);
        }}
      />
    </>
  );
}
