"use client";

import {
  CheckCircle2,
  GitCompareArrows,
  Mic,
  RefreshCw,
  Sparkles,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { useAction } from "@/hooks/use-action";
import { requestSuggestion } from "@/lib/mutations";
import type { SubmissionSuggestion, SuggestionVerdict } from "@/lib/types";

const VERDICT: Record<SuggestionVerdict, { tone: BadgeTone; icon: LucideIcon; label: string }> = {
  baik: { tone: "success", icon: CheckCircle2, label: "Sudah baik" },
  tinjau: { tone: "info", icon: Telescope, label: "Perlu pendalaman" },
  cekpaham: { tone: "warning", icon: Mic, label: "Pertimbangkan Cek Paham" },
  bandingkan: { tone: "warning", icon: GitCompareArrows, label: "Bandingkan dulu" },
};

interface SuggestionPanelProps {
  submissionId: string;
  /** Analisis (OCR, indikasi AI, Bloom) harus selesai dulu; saran dibangun dari hasilnya. */
  ready: boolean;
  /** Dipanggil saat dosen memakai draf umpan balik dari narasi. */
  onUseFeedbackDraft: (draft: string) => void;
}

/** Saran satu klik: sudah baik, perlu Cek Paham, atau dibandingkan. Hanya berjalan saat ditekan. */
export function SuggestionPanel({ submissionId, ready, onUseFeedbackDraft }: SuggestionPanelProps) {
  const [result, setResult] = useState<SubmissionSuggestion | null>(null);
  const { pending, error, run } = useAction("Saran belum bisa dibuat. Coba lagi.");

  async function ask() {
    await run(
      () => requestSuggestion(submissionId),
      (value) => setResult(value),
    );
  }

  const verdict = result ? VERDICT[result.verdict] : null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <IconTile icon={Sparkles} size="sm" />
        <div>
          <h2 className="font-bold text-foreground">Saran untuk Anda</h2>
          <p className="text-xs text-muted-foreground">Dari bukti analisis, sekali klik</p>
        </div>
      </div>

      {!result ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            {ready
              ? "Ringkas apakah jawaban ini sudah baik, perlu Cek Paham, atau perlu dibandingkan dengan mahasiswa lain."
              : "Menunggu analisis selesai (pembacaan dokumen, indikasi AI, dan level Bloom). Tombol aktif otomatis setelahnya."}
          </p>
          <Button type="button" className="mt-3 w-full" disabled={!ready || pending} onClick={ask}>
            <Sparkles /> {pending ? "Menyusun saran…" : "Minta saran"}
          </Button>
        </>
      ) : verdict ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={verdict.tone} size="md">
              <verdict.icon className="h-3.5 w-3.5" aria-hidden="true" /> {verdict.label}
            </Badge>
            <button
              type="button"
              onClick={ask}
              disabled={pending}
              aria-label="Susun ulang saran"
              className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
            </button>
          </div>
          <p className="font-semibold text-foreground">{result.headline}</p>

          {result.narrative ? (
            <div className="space-y-2 rounded-lg bg-muted px-3 py-2.5 text-sm">
              <p className="text-foreground">{result.narrative.ringkasan}</p>
              {result.narrative.kekuatan.length ? (
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Kekuatan:</strong>{" "}
                  {result.narrative.kekuatan.join("; ")}
                </p>
              ) : null}
              {result.narrative.kekurangan.length ? (
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Bisa diperdalam:</strong>{" "}
                  {result.narrative.kekurangan.join("; ")}
                </p>
              ) : null}
              {result.narrative.draf_umpan_balik ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onUseFeedbackDraft(result.narrative!.draf_umpan_balik)}
                >
                  Pakai sebagai draf umpan balik
                </Button>
              ) : null}
            </div>
          ) : result.narrative_skipped ? (
            <p className="text-xs text-muted-foreground">{result.narrative_skipped}</p>
          ) : null}

          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {result.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div>
            <p className="text-xs font-semibold text-foreground">Langkah yang disarankan</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {result.next_steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">{result.caveats.join(" ")}</p>
        </div>
      ) : null}

      {error ? (
        <Alert variant="danger" title="Saran gagal" className="mt-3">
          {error}
        </Alert>
      ) : null}
    </Card>
  );
}
