"use client";

import { CheckCircle2, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Callout } from "@/components/common/Callout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SPEECH_LEVEL, countWords } from "@/lib/cekpaham";

import { MicMeter } from "./MicMeter";
import type { Microphone } from "./useMicrophone";
import { useLiveCaption } from "./useLiveCaption";

const TEST_SEGMENT_MS = 3000;
const MIN_WORDS = 3;
// Bila caption tidak tersedia, mikrofon dianggap baik setelah sekian detik terdengar bicara.
const FALLBACK_SPEECH_MS = 2000;
const TICK_MS = 100;

/** Audio tes tidak disimpan; potongannya hanya ditranskripsi untuk ditampilkan ke mahasiswa. */
export function MicTestStep({
  cekpahamId,
  mic,
  onPassed,
}: {
  cekpahamId: string;
  mic: Microphone;
  onPassed: () => void;
}) {
  const caption = useLiveCaption(cekpahamId, "mic_test");
  const [speechMs, setSpeechMs] = useState(0);
  const levelRef = useRef(mic.level);
  levelRef.current = mic.level;

  const ready = mic.status === "ready";
  const { startSegments, stopSegments } = mic;
  const { push } = caption;

  useEffect(() => {
    if (!ready) return;
    startSegments(push, TEST_SEGMENT_MS);
    const tick = setInterval(() => {
      if (levelRef.current >= SPEECH_LEVEL) setSpeechMs((ms) => ms + TICK_MS);
    }, TICK_MS);
    return () => {
      clearInterval(tick);
      stopSegments();
    };
  }, [ready, startSegments, stopSegments, push]);

  const words = countWords(caption.text);
  const passed = ready && (caption.available ? words >= MIN_WORDS : speechMs >= FALLBACK_SPEECH_MS);

  if (mic.status === "denied" || mic.status === "unsupported" || mic.status === "error" || mic.status === "lost") {
    const message = {
      denied: "Izin mikrofon ditolak. Buka pengaturan situs di peramban, izinkan mikrofon, lalu coba lagi.",
      unsupported: "Peramban ini tidak mendukung perekaman suara. Coba Chrome, Edge, Firefox, atau Safari terbaru.",
      error: "Mikrofon tidak bisa dibuka. Pastikan tidak dipakai aplikasi lain, lalu coba lagi.",
      lost: "Mikrofon terputus. Sambungkan kembali, lalu coba lagi.",
    }[mic.status];
    return (
      <Card className="space-y-4 p-6 shadow-soft">
        <div className="flex items-center gap-2 text-danger">
          <MicOff className="h-5 w-5" aria-hidden="true" />
          <h2 className="text-lg font-bold">Mikrofon belum bisa dipakai</h2>
        </div>
        <p className="text-body-sm text-muted-foreground">{message}</p>
        {mic.status !== "unsupported" ? (
          <Button onClick={() => void mic.request()}>Coba lagi</Button>
        ) : null}
      </Card>
    );
  }

  if (!ready) {
    return (
      <Card className="space-y-4 p-6 shadow-soft">
        <h2 className="text-lg font-bold text-foreground">Tes mikrofon</h2>
        <p className="text-body-sm text-muted-foreground">
          Peramban akan meminta izin memakai mikrofon. Tes ini tidak disimpan dan tidak dinilai.
        </p>
        <Button disabled={mic.status === "requesting"} onClick={() => void mic.request()}>
          {mic.status === "requesting" ? "Menunggu izin..." : "Izinkan mikrofon"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-6 shadow-soft">
      <div>
        <h2 className="text-lg font-bold text-foreground">Tes mikrofon</h2>
        <p className="text-body-sm text-muted-foreground">
          Ucapkan kalimat bebas, misalnya &ldquo;Halo, saya sedang mencoba mikrofon untuk Cek
          Paham.&rdquo; Tes ini tidak disimpan dan tidak dinilai.
        </p>
      </div>

      <MicMeter level={mic.level} />

      <div className="min-h-16 rounded-xl border border-border bg-secondary/30 p-4 text-body-sm">
        {caption.text ? (
          <p className="text-foreground">{caption.text}</p>
        ) : (
          <p className="text-muted-foreground">
            {caption.available ? "Transkrip tes muncul di sini..." : "Transkrip langsung tidak tersedia, tetapi mikrofonmu tetap bisa dipakai."}
          </p>
        )}
        {caption.pending > 0 ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-caption text-muted-foreground" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> mendengarkan...
          </p>
        ) : null}
      </div>

      {!caption.available ? (
        <Callout variant="warning">
          Transkrip langsung sedang tidak tersedia. Jawabanmu tetap direkam dan transkripnya muncul
          setelah kamu selesai.
        </Callout>
      ) : null}

      {passed ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Mikrofonmu terbaca dengan baik
          </span>
          <Button onClick={onPassed}>Lanjut</Button>
        </div>
      ) : (
        <p className="text-body-sm text-muted-foreground">
          Belum terbaca cukup jelas. Bicara lebih dekat ke mikrofon dengan suara biasa.
        </p>
      )}
    </Card>
  );
}
