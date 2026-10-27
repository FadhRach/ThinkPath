"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toUtf16Spans } from "@/features/submissions/lib/offsets";
import { getApiErrorMessage } from "@/lib/api/messages";
import { getSubmissionComparison } from "@/lib/mutations";
import type { ComparisonSide, SubmissionComparison } from "@/lib/types";

function Side({ side }: { side: ComparisonSide }) {
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  toUtf16Spans(side.text, side.spans).forEach((span, index) => {
    if (span.start > cursor) pieces.push(side.text.slice(cursor, span.start));
    pieces.push(
      <mark key={index} className="rounded-sm bg-warning-soft px-0.5 text-foreground">
        {side.text.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  });
  if (cursor < side.text.length) pieces.push(side.text.slice(cursor));

  return (
    <section className="min-w-0 space-y-2">
      <h3 className="text-sm font-bold text-foreground">{side.student_name}</h3>
      <div className="max-h-[50vh] overflow-y-auto rounded-lg bg-muted/40 p-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-7">{pieces}</p>
      </div>
    </section>
  );
}

/** Dua jawaban berdampingan; potongan lima kata yang sama persis disorot di keduanya. */
export function ComparisonDialog({
  submissionId,
  otherId,
  open,
  onOpenChange,
}: {
  submissionId: string;
  otherId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<SubmissionComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData(null);
    setError(null);
    getSubmissionComparison(submissionId, otherId)
      .then((value) => !cancelled && setData(value))
      .catch((err) => !cancelled && setError(getApiErrorMessage(err, "Gagal memuat pembanding.")));
    return () => {
      cancelled = true;
    };
  }, [open, submissionId, otherId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Bandingkan jawaban
            {data ? (
              <Badge tone={data.score >= 0.6 ? "danger" : "warning"}>
                {Math.round(data.score * 100)}% mirip
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Bagian yang disorot sama persis (minimal lima kata berurutan) di kedua jawaban. Kutipan
            dari soal atau bacaan yang sama ikut tersorot.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {!data && !error ? <Skeleton className="h-64 w-full" /> : null}
        {data ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Side side={data.a} />
            <Side side={data.b} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
