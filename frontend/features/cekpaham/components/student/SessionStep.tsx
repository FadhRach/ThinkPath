"use client";

import { Mic, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { secondsLeft } from "@/features/cekpaham/lib/recording";
import type { CekPahamStart } from "@/lib/types";
import { cn } from "@/lib/utils";

import { MicMeter } from "./MicMeter";
import type { LostReason, Microphone } from "@/features/cekpaham/hooks/useMicrophone";
import { useLiveCaption } from "@/features/cekpaham/hooks/useLiveCaption";

export type EndedReason = "manual" | "time" | LostReason;

export interface SessionResult {
  liveTranscript: string;
  endedReason: EndedReason;
}

const LIVE_SEGMENT_MS = 4000;
const TICK_MS = 250;
const LOW_TIME_SECONDS = 10;

/**
 * Sesi menjawab. Sengaja TANPA elemen input, textarea, atau contenteditable:
 * jawaban hanya lewat suara. Soal tidak bisa diseleksi sebagai pengaman
 * kosmetik saja; pengamannya sesungguhnya transkrip dari audio di server.
 */
export function SessionStep({
  cekpahamId,
  started,
  mic,
  registerLost,
  onFinish,
}: {
  cekpahamId: string;
  started: { data: CekPahamStart; at: number };
  mic: Microphone;
  registerLost: (handler: ((reason: LostReason) => void) | null) => void;
  onFinish: (result: SessionResult) => void;
}) {
  const caption = useLiveCaption(cekpahamId, "answer");
  const { data } = started;
  const [left, setLeft] = useState(data.answer_seconds);
  const finished = useRef(false);

  const finishRef = useRef((reason: EndedReason) => {
    if (finished.current) return;
    finished.current = true;
    onFinish({ liveTranscript: caption.getText(), endedReason: reason });
  });
  finishRef.current = (reason: EndedReason) => {
    if (finished.current) return;
    finished.current = true;
    onFinish({ liveTranscript: caption.getText(), endedReason: reason });
  };

  const { startSegments, stopSegments } = mic;
  const { push } = caption;

  useEffect(() => {
    startSegments(push, LIVE_SEGMENT_MS);
    return () => stopSegments();
  }, [startSegments, stopSegments, push]);

  useEffect(() => {
    registerLost((reason) => finishRef.current(reason));
    return () => registerLost(null);
  }, [registerLost]);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = secondsLeft(
        data.deadline_at,
        data.server_now,
        performance.now() - started.at,
      );
      setLeft(remaining);
      if (remaining <= 0) finishRef.current("time");
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [data.deadline_at, data.server_now, started.at]);

  const low = left <= LOW_TIME_SECONDS;
  return (
    <Card variant="raised" className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-danger-soft px-3 py-1 text-caption font-semibold text-danger">
          <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden="true" />
          Merekam
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-lg font-bold tabular-nums",
            low ? "text-danger" : "text-foreground",
          )}
          aria-live="off"
        >
          <Timer className="h-5 w-5" aria-hidden="true" />
          {left} detik
        </span>
      </div>

      <Progress value={(left / data.answer_seconds) * 100} aria-label="Sisa waktu menjawab" />

      <div className="select-none rounded-xl border border-brand-mint bg-secondary/40 p-5">
        <p className="caption-eyebrow mb-1 text-brand-ink">Pertanyaan</p>
        <p className="text-lg font-semibold leading-snug text-foreground">{data.question_text}</p>
      </div>

      <div className="space-y-2">
        <p className="inline-flex items-center gap-2 text-caption font-semibold text-muted-foreground">
          <Mic className="h-4 w-4" aria-hidden="true" /> Yang terdengar (hanya untuk dibaca, tidak
          bisa diubah)
        </p>
        <MicMeter level={mic.level} />
        <div
          className="min-h-20 rounded-xl border border-border p-4 text-body-sm"
          aria-live="polite"
        >
          {caption.text ? (
            <p className="text-foreground">{caption.text}</p>
          ) : (
            <p className="text-muted-foreground">
              {caption.available
                ? "Mulai bicara. Transkrip akan muncul di sini..."
                : "Transkrip langsung tidak tersedia."}
            </p>
          )}
          {caption.pending > 0 ? (
            <p
              className="mt-2 inline-flex items-center gap-1.5 text-caption text-muted-foreground"
              aria-hidden="true"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> mendengarkan...
            </p>
          ) : null}
        </div>
      </div>

      {!caption.available ? (
        <Alert variant="warning">
          Transkrip langsung tidak tersedia, tetapi jawabanmu tetap direkam. Transkrip lengkapnya
          muncul setelah kamu selesai.
        </Alert>
      ) : null}

      <Button variant="outline" onClick={() => finishRef.current("manual")}>
        Selesai menjawab
      </Button>
    </Card>
  );
}
