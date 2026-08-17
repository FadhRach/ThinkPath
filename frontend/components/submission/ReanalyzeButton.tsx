"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { reanalyzeSubmission } from "@/lib/mutations";
import { useAction } from "@/lib/use-action";

export function ReanalyzeButton({ submissionId }: { submissionId: string }) {
  const { pending, error, run } = useAction("Analisis ulang gagal. Coba lagi.");

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={() => run(() => reanalyzeSubmission(submissionId))}
        disabled={pending}
        variant="outline"
        className="w-full"
      >
        <RefreshCw className="h-4 w-4" />
        {pending ? "Menganalisis..." : "Analisis Ulang"}
      </Button>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
