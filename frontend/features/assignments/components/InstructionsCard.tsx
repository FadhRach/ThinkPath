import { FileText } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";

/** Instruksi tugas dari dosen, dengan keterangan bila dosen belum menulisnya. */
export function InstructionsCard({ instructions }: { instructions: string }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <IconTile icon={FileText} size="sm" />
        <h2 className="font-bold text-foreground">Instruksi tugas</h2>
      </div>
      {instructions ? (
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-foreground">{instructions}</p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Dosen belum menambahkan instruksi khusus untuk tugas ini.
        </p>
      )}
    </Card>
  );
}
