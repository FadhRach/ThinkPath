"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { MicMeter } from "./MicMeter";

export function ReadyStep({
  answerSeconds,
  level,
  pending,
  error,
  onStart,
}: {
  answerSeconds: number;
  level: number;
  pending: boolean;
  error: string | null;
  onStart: () => void;
}) {
  return (
    <Card variant="raised" className="space-y-5 p-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Siap menjawab?</h2>
        <p className="text-body-sm text-muted-foreground">
          Begitu kamu menekan <strong className="text-foreground">Mulai</strong>, pertanyaan
          langsung tampil dan mikrofon langsung merekam. Kamu punya{" "}
          <strong className="text-foreground">{answerSeconds} detik</strong>, dan waktunya tidak
          bisa dihentikan. Cari tempat yang tenang dulu bila perlu.
        </p>
      </div>
      <MicMeter level={level} />
      <Button size="lg" disabled={pending} onClick={onStart}>
        {pending ? "Memulai..." : "Mulai menjawab"}
      </Button>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </Card>
  );
}
