"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { reanalyzeSubmission } from "@/lib/mutations";
import { useAction } from "@/lib/use-action";

/** `busy`: worker sedang mengerjakan analisis untuk pengumpulan ini. */
export function ReanalyzeButton({ submissionId, busy = false }: { submissionId: string; busy?: boolean }) {
  const { pending, error, run } = useAction("Analisis ulang gagal. Coba lagi.");

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={() => run(() => reanalyzeSubmission(submissionId))}
        disabled={pending || busy}
        variant="outline"
        className="w-full"
      >
        <RefreshCw className="h-4 w-4" />
        {pending || busy ? "Menganalisis..." : "Analisis Ulang"}
      </Button>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
