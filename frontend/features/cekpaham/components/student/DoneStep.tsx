"use client";

import { CheckCircle2, ChevronDown, Hourglass, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASON_LABEL, STUDENT_STATE_MESSAGE } from "@/features/cekpaham/lib/labels";
import { formatClockHHMM, formatDate } from "@/lib/formatting";
import { reportCekPaham } from "@/lib/mutations";
import type { CekPahamReportReason, StudentCekPaham } from "@/lib/types";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

type AttemptView = NonNullable<StudentCekPaham["attempt"]>;

const REASONS = Object.keys(REPORT_REASON_LABEL) as CekPahamReportReason[];
const NOTE_MAX = 1000;
const REPORT_STATUS_LABEL = {
  open: "Menunggu tanggapan dosen",
  dismissed: "Sudah ditanggapi",
  retry_granted: "Kamu boleh mengulang",
} as const;

/** Hasil untuk mahasiswa: transkripnya sendiri dan jalur lapor. Tanpa skor, band, atau flag. */
export function DoneStep({
  cekpahamId,
  attempt,
  onAttempt,
}: {
  cekpahamId: string;
  attempt: AttemptView;
  onAttempt: (attempt: AttemptView | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CekPahamReportReason | null>(null);
  const [note, setNote] = useState("");
  const { pending, error, run } = useAction("Laporan gagal dikirim. Coba lagi.");

  const Icon =
    attempt.state === "done"
      ? CheckCircle2
      : attempt.state === "processing" || attempt.state === "in_progress"
        ? Hourglass
        : TriangleAlert;

  return (
    <div className="space-y-5">
      <Card variant="raised" className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {attempt.state === "done"
                ? "Terima kasih, jawabanmu sudah terkirim"
                : "Status Cek Paham"}
            </h2>
            <p className="text-body-sm text-muted-foreground">
              {STUDENT_STATE_MESSAGE[attempt.state]}
            </p>
          </div>
        </div>

        {attempt.transcript ? (
          <div>
            <p className="caption-eyebrow mb-1 text-brand-ink">Transkrip jawabanmu</p>
            <blockquote className="rounded-xl border border-border bg-secondary/30 p-4 text-body-sm leading-relaxed text-foreground">
              {attempt.transcript}
            </blockquote>
            <p className="mt-2 text-caption text-muted-foreground">
              Transkrip dibuat otomatis dan bisa salah dengar. Bila ada yang tidak sesuai dengan
              ucapanmu, laporkan di bawah; dosen akan melihat laporanmu bersama rekamannya.
            </p>
          </div>
        ) : null}
      </Card>

      {attempt.reports.length > 0 ? (
        <Card variant="raised" className="space-y-3 p-6">
          <p className="caption-eyebrow text-brand-ink">Laporanmu</p>
          {attempt.reports.map((report) => (
            <div
              key={report.created_at}
              className="rounded-xl border border-border p-4 text-body-sm"
            >
              <p className="font-semibold text-foreground">
                {REPORT_REASON_LABEL[report.reason]} &middot;{" "}
                <span className="font-normal text-muted-foreground">
                  {REPORT_STATUS_LABEL[report.status]}
                </span>
              </p>
              <p className="text-caption text-muted-foreground">
                Dikirim {formatDate(report.created_at)} pukul {formatClockHHMM(report.created_at)}
              </p>
              {report.response_note ? (
                <p className="mt-2 text-foreground">Tanggapan dosen: {report.response_note}</p>
              ) : null}
            </div>
          ))}
        </Card>
      ) : null}

      {attempt.can_report ? (
        <Card variant="raised" className="space-y-4 p-6">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="block font-semibold text-foreground">
                Ada gangguan atau kendala pada Cek Paham?
              </span>
              <span className="block text-body-sm text-muted-foreground">
                Misalnya mikrofon bermasalah atau transkrip berbeda dari ucapanmu.
              </span>
            </span>
            <ChevronDown
              className={cn("h-5 w-5 shrink-0 transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
          </button>
          {open ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-body-sm font-medium text-foreground">
                  Jenis kendala (boleh dikosongkan)
                </p>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={reason === value}
                      onClick={() => setReason(reason === value ? null : value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-body-sm transition",
                        reason === value
                          ? "border-primary bg-secondary/40 font-medium text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {REPORT_REASON_LABEL[value]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cekpaham-note">Penjelasan (boleh dikosongkan)</Label>
                <Textarea
                  id="cekpaham-note"
                  rows={3}
                  maxLength={NOTE_MAX}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Misalnya: saya bilang 'rekursif', tetapi tertulis 'rekursi'."
                />
                <p className="text-caption text-muted-foreground">
                  Dosen akan melihat laporanmu bersama rekaman dan transkripnya.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      reportCekPaham(cekpahamId, {
                        reason: reason ?? undefined,
                        note: note.trim(),
                      }),
                    (updated) => {
                      setNote("");
                      setReason(null);
                      setOpen(false);
                      onAttempt(updated.attempt);
                    },
                  )
                }
              >
                {pending ? "Mengirim..." : "Kirim laporan"}
              </Button>
              {error ? <p className="text-body-sm text-danger">{error}</p> : null}
            </div>
          ) : null}
        </Card>
      ) : attempt.state === "in_progress" ? (
        <Alert variant="info">
          Sesimu masih tercatat berjalan. Muat ulang halaman ini beberapa saat lagi.
        </Alert>
      ) : null}
    </div>
  );
}
