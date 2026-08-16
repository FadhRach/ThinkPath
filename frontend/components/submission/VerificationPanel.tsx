"use client";

import { CalendarClock, CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatClockHHMM,
  formatDateTimeInput,
  parseDateTimeInput,
} from "@/lib/formatting";
import { cancelVerification, saveVerification } from "@/lib/mutations";
import type { VerificationOutcome, VerificationView } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import {
  OUTCOME_HINT,
  OUTCOME_LABEL,
  OUTCOME_TONE,
  STATUS_LABEL,
} from "@/lib/verification";
import { cn } from "@/lib/utils";

interface Props {
  submissionId: string;
  verification: VerificationView | null;
}

const OUTCOMES: Exclude<VerificationOutcome, "">[] = [
  "can_explain",
  "partial",
  "cannot_explain",
  "inconclusive",
];

/**
 * Tindak lanjut dari rekomendasi sistem.
 *
 * Tanpa panel ini, rekomendasi "disarankan diskusi 10-15 menit" berhenti
 * sebagai kalimat dan tidak pernah bisa ditindaklanjuti. Di sinilah manusia
 * mengambil keputusan, dan itu memang seharusnya begitu.
 *
 * Kesimpulan hanya bisa diisi setelah sesi ditandai selesai. Membiarkan dosen
 * menyimpulkan saat baru menjadwalkan berarti menyimpulkan sebelum berbicara.
 */
export function VerificationPanel({ submissionId, verification }: Props) {
  const [scheduledAt, setScheduledAt] = useState(
    formatDateTimeInput(verification?.scheduled_at ?? null),
  );
  const [notes, setNotes] = useState(verification?.notes ?? "");
  const [outcome, setOutcome] = useState<VerificationOutcome>(
    verification?.outcome ?? "",
  );
  const { pending: loading, error, run } = useAction("Gagal menyimpan. Coba lagi.");

  const status = verification?.status ?? null;
  const isCompleted = status === "completed";

  if (isCompleted) {
    return (
      <Card className="space-y-3 p-5 shadow-soft">
        <p className="caption-eyebrow text-primary">Verifikasi Verbal</p>
        <div className="flex flex-wrap items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-body-sm font-semibold text-foreground">
            {STATUS_LABEL.completed}
          </span>
          {verification?.outcome ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-body-sm font-medium",
                OUTCOME_TONE[verification.outcome],
              )}
            >
              {OUTCOME_LABEL[verification.outcome]}
            </span>
          ) : null}
        </div>
        {verification?.notes ? (
          <p className="whitespace-pre-wrap text-body-sm text-foreground">
            {verification.notes}
          </p>
        ) : null}
        <p className="text-caption text-muted-foreground">
          Kesimpulan ini berasal dari percakapan langsung, bukan dari skor. Skor
          AI di atas tidak diubah olehnya.
        </p>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => run(() => cancelVerification(submissionId))}
        >
          Hapus catatan verifikasi
        </Button>
        {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5 shadow-soft">
      <div>
        <p className="caption-eyebrow text-primary">Verifikasi Verbal</p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {status === "scheduled"
            ? `Dijadwalkan ${formatClockHHMM(verification?.scheduled_at ?? null)}. Catat hasilnya setelah sesi berlangsung.`
            : "Ajak mahasiswa menjelaskan kembali jawabannya. Kesimpulan diisi setelah sesi, bukan sebelumnya."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="verif-time">Waktu sesi</Label>
        <input
          id="verif-time"
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-body shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="verif-notes">Catatan</Label>
        <Textarea
          id="verif-notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Apa yang ditanyakan, dan bagaimana mahasiswa menjawabnya."
        />
      </div>

      {status === "scheduled" ? (
        <div className="space-y-2">
          <Label>Kesimpulan setelah sesi</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {OUTCOMES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setOutcome(value)}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  outcome === value
                    ? "border-primary bg-secondary/30 ring-1 ring-primary"
                    : "border-border hover:border-primary/40",
                )}
              >
                <span className="block text-body-sm font-semibold text-foreground">
                  {OUTCOME_LABEL[value]}
                </span>
                <span className="block text-caption text-muted-foreground">
                  {OUTCOME_HINT[value]}
                </span>
              </button>
            ))}
          </div>
          <p className="text-caption text-muted-foreground">
            Tidak ada pilihan yang menyimpulkan kecurangan. Yang dinilai adalah
            kemampuan menjelaskan, dan itu sudah cukup untuk ditindaklanjuti.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={loading || !scheduledAt}
          onClick={() =>
            run(() =>
              saveVerification(submissionId, {
                status: "scheduled",
                scheduled_at: parseDateTimeInput(scheduledAt),
                notes,
              }),
            )
          }
        >
          <CalendarClock className="mr-1.5 h-4 w-4" />
          {status === "scheduled" ? "Perbarui jadwal" : "Jadwalkan sesi"}
        </Button>

        {status === "scheduled" ? (
          <>
            <Button
              variant="outline"
              disabled={loading || !outcome}
              onClick={() =>
                run(() =>
                  saveVerification(submissionId, {
                    status: "completed",
                    outcome,
                    notes,
                  }),
                )
              }
            >
              Tandai selesai
            </Button>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() => run(() => cancelVerification(submissionId))}
            >
              Batalkan
            </Button>
          </>
        ) : null}
      </div>
    </Card>
  );
}
