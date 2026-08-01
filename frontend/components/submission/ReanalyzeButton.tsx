"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-shared";
import { reanalyzeSubmission } from "@/lib/mutations";

export function ReanalyzeButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      await reanalyzeSubmission(submissionId);
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "Analisis ulang gagal. Coba lagi."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading}
        variant="outline"
        className="w-full"
      >
        <RefreshCw className="h-4 w-4" />
        {loading ? "Menganalisis..." : "Analisis Ulang"}
      </Button>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
