"use client";

import { GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { ComparisonDialog } from "@/features/submissions/components/ComparisonDialog";
import type { SimilarSubmission } from "@/lib/types";

/** Di atas ini dua jawaban dianggap sangat mirip dan dosen diajak membandingkannya. */
const HIGH = 0.6;
const MID = 0.25;

/** Jawaban lain di tugas yang sama dengan potongan lima kata yang sama persis. */
export function SimilarSubmissionsCard({
  submissionId,
  items,
}: {
  submissionId: string;
  items: SimilarSubmission[];
}) {
  const [comparing, setComparing] = useState<string | null>(null);
  const high = items.filter((item) => item.score >= HIGH);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <IconTile icon={GitCompareArrows} size="sm" />
        <div>
          <h2 className="font-bold text-foreground">Kemiripan dengan mahasiswa lain</h2>
          <p className="text-xs text-muted-foreground">Pada tugas yang sama</p>
        </div>
      </div>

      {high.length ? (
        <Alert
          variant="warning"
          title={`${high.length} jawaban sangat mirip (60% ke atas)`}
          className="mt-3"
        >
          Bandingkan dulu berdampingan sebelum menyimpulkan.
        </Alert>
      ) : null}

      {items.length ? (
        <ul className="mt-3 divide-y divide-border/60">
          {items.map((item) => (
            <li key={item.submission_id} className="flex items-center gap-2.5 py-2.5">
              <AvatarInitials name={item.student_name} size="sm" />
              <Link
                href={`/dashboard/submission/${item.submission_id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
              >
                {item.student_name}
              </Link>
              <Badge
                tone={item.score >= HIGH ? "danger" : item.score >= MID ? "warning" : "neutral"}
              >
                {Math.round(item.score * 100)}%
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setComparing(item.submission_id)}
              >
                Bandingkan
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Tidak ada jawaban lain yang mirip. Jawaban ini tampak ditulis sendiri.
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Persentase irisan potongan lima kata berurutan. Kutipan dari soal atau bacaan yang sama juga
        ikut mirip, jadi buka jawabannya sebelum menyimpulkan.
      </p>

      {comparing ? (
        <ComparisonDialog
          submissionId={submissionId}
          otherId={comparing}
          open
          onOpenChange={(open) => !open && setComparing(null)}
        />
      ) : null}
    </Card>
  );
}
