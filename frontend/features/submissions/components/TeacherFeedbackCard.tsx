import { MessageSquareText } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";

/** Masukan dosen, ditaruh paling atas begitu jawaban dinilai. */
export function TeacherFeedbackCard({
  feedback,
  grade,
}: {
  feedback: string;
  grade: number | null;
}) {
  return (
    <Card className="border-success/40 bg-success-soft/50 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <IconTile icon={MessageSquareText} tone="success" size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-foreground">Masukan dari dosen</h2>
          {feedback.trim() ? (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:text-base sm:leading-7">
              {feedback}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Dosen menilai jawabanmu{grade !== null ? ` dengan nilai ${grade}` : ""} tanpa catatan
              tambahan.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
