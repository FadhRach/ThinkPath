import { FileUp } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";

/** Ajakan mengunggah dokumen sebagai jawaban (hanya bila dosen mengizinkannya). */
export function DocumentPickerCard({ picker }: { picker: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <IconTile icon={FileUp} size="sm" />
        <div>
          <h2 className="font-bold text-foreground">Sudah mengerjakan di Word atau PDF?</h2>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
            Unggah dokumennya (Word, PDF, atau foto, maks. 10 MB). Teksnya dibaca otomatis. Nama dan
            NIM bisa kamu tulis di kotak di bawah, atau ketik jawabanmu langsung di sana.
          </p>
        </div>
      </div>
      <div className="shrink-0">{picker}</div>
    </Card>
  );
}
