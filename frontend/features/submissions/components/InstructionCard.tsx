import { ClipboardList } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { InstructionText } from "@/features/assignments/components/InstructionText";
import type { SubmissionDetail } from "@/lib/types";

/** Instruksi tugas di atas jawaban, supaya dosen menilai jawaban terhadap apa yang diminta. */
export function InstructionCard({ assignment }: { assignment: SubmissionDetail["assignment"] }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile icon={ClipboardList} size="sm" />
        <h2 className="font-bold text-foreground">Instruksi tugas</h2>
      </div>
      <InstructionText text={assignment.instructions} rich={assignment.instructions_rich} />
    </Card>
  );
}
