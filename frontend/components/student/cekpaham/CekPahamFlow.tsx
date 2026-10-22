"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Callout } from "@/components/common/Callout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, NetworkError, getApiErrorMessage } from "@/lib/api-shared";
import { PHASE_LABEL } from "@/lib/cekpaham";
import { formatClockHHMM, formatDate } from "@/lib/formatting";
import { finalizeCekPaham, startCekPaham, type FinalizeCekPahamInput } from "@/lib/mutations";
import type { CekPahamStart, StudentCekPaham } from "@/lib/types";
import { useAction } from "@/lib/use-action";

import { DoneStep } from "./DoneStep";
import { IntroStep } from "./IntroStep";
import { MicTestStep } from "./MicTestStep";
import { ReadyStep } from "./ReadyStep";
import { SessionStep, type SessionResult } from "./SessionStep";
import { useMicrophone, type LostReason } from "./useMicrophone";

type Step = "intro" | "mic-test" | "ready" | "session" | "processing" | "done";

const UPLOAD_ATTEMPTS = 3;
const BACKOFF_MS = 1500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function initialStep(cekpaham: StudentCekPaham): Step {
  return cekpaham.attempt ? "done" : "intro";
}

/** Galat sementara layak dicoba lagi; 4xx lain (izin ditarik, sesi tidak ada) tidak akan berubah. */
function isTransient(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return error instanceof ApiError && (error.status >= 500 || error.status === 429);
}

/** Kirim jawaban; galat sementara dicoba ulang dengan jeda yang makin panjang. */
async function finalizeWithRetry(id: string, body: FinalizeCekPahamInput) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await finalizeCekPaham(id, body);
    } catch (error) {
      if (!isTransient(error) || attempt >= UPLOAD_ATTEMPTS) throw error;
      await sleep(BACKOFF_MS * 2 ** (attempt - 1));
    }
  }
}

/**
 * Alur mahasiswa sebagai mesin keadaan eksplisit. Mikrofon hidup di sini (bukan
 * di tiap layar) supaya izin dan stream bertahan dari tes mic sampai sesi.
 */
export function CekPahamFlow({ initial }: { initial: StudentCekPaham }) {
  const [step, setStep] = useState<Step>(initialStep(initial));
  const [attempt, setAttempt] = useState(initial.attempt);
  const [started, setStarted] = useState<{ data: CekPahamStart; at: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const lostHandler = useRef<((reason: LostReason) => void) | null>(null);
  const payload = useRef<FinalizeCekPahamInput | null>(null);
  const startAction = useAction("Tidak bisa memulai. Coba lagi.");

  const mic = useMicrophone((reason) => lostHandler.current?.(reason));
  const registerLost = useCallback((handler: ((reason: LostReason) => void) | null) => {
    lostHandler.current = handler;
  }, []);

  const upload = useCallback(async () => {
    const body = payload.current;
    if (!body) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await finalizeWithRetry(initial.id, body);
      payload.current = null;
      setAttempt({
        number: started?.data.number ?? 1,
        state: result.state,
        transcript: result.transcript,
        can_report: true,
        reports: [],
      });
      setStep("done");
    } catch (error) {
      setUploadError(getApiErrorMessage(error, "Jawabanmu belum terkirim. Periksa koneksi, lalu kirim ulang."));
    } finally {
      setUploading(false);
    }
  }, [initial.id, started]);

  const finishSession = useCallback(
    async (result: SessionResult) => {
      mic.stopSegments();
      const audio = await mic.stopFull();
      const events = { ...mic.getEvents(), ended_reason: result.endedReason };
      mic.release();
      const lost = result.endedReason === "track_ended" || result.endedReason === "dead_input";
      payload.current = {
        audio,
        liveTranscript: result.liveTranscript,
        clientEvents: events,
        interrupted: lost,
      };
      setStep("processing");
      await upload();
    },
    [mic, upload],
  );

  // Jangan biarkan tab tertutup selama jawaban belum terkirim: audionya hanya ada di memori.
  useEffect(() => {
    if (step !== "processing") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);

  function begin() {
    void startAction.run(
      () => startCekPaham(initial.id),
      (data) => {
        setStarted({ data, at: performance.now() });
        mic.startMonitoring();
        mic.startFull();
        setStep("session");
      },
    );
  }

  if (!attempt && initial.phase !== "open") {
    return (
      <Callout variant="warning" title={PHASE_LABEL[initial.phase]}>
        {initial.phase === "upcoming"
          ? `Cek Paham ini baru dibuka ${formatDate(initial.window_start)} pukul ${formatClockHHMM(initial.window_start)}.`
          : initial.phase === "closed"
            ? "Waktu pengerjaannya sudah ditutup. Hubungi dosenmu bila ada kendala."
            : "Dosen sudah membatalkan Cek Paham ini."}
      </Callout>
    );
  }

  switch (step) {
    case "intro":
      // Izin suara diberikan sekali di Pengaturan, bukan setiap kali memakai fitur ini.
      if (!initial.consent.ready) {
        return (
          <Callout variant="info" title="Izin rekaman suara belum aktif">
            Cek Paham dijawab dengan suara. Aktifkan &ldquo;rekaman suara&rdquo; dan &ldquo;analisis di luar
            negeri&rdquo; satu kali di{" "}
            <Link href={initial.consent.policy_current ? "/student/pengaturan" : "/persetujuan"} className="font-semibold underline">
              {initial.consent.policy_current ? "Pengaturan > Privasi" : "halaman persetujuan"}
            </Link>
            , lalu kembali ke halaman ini.
          </Callout>
        );
      }
      return <IntroStep cekpaham={initial} onNext={() => setStep("mic-test")} />;
    case "mic-test":
      return <MicTestStep cekpahamId={initial.id} mic={mic} onPassed={() => setStep("ready")} />;
    case "ready":
      return (
        <ReadyStep
          answerSeconds={initial.answer_seconds}
          level={mic.level}
          pending={startAction.pending}
          error={startAction.error}
          onStart={begin}
        />
      );
    case "session":
      return started ? (
        <SessionStep
          cekpahamId={initial.id}
          started={started}
          mic={mic}
          registerLost={registerLost}
          onFinish={(result) => void finishSession(result)}
        />
      ) : null;
    case "processing":
      return (
        <Card className="space-y-4 p-6 shadow-soft" aria-live="polite">
          <h2 className="text-lg font-bold text-foreground">
            {uploadError ? "Jawabanmu belum terkirim" : "Mengirim dan memproses jawabanmu..."}
          </h2>
          {uploadError ? (
            <>
              <p className="text-body-sm text-danger">{uploadError}</p>
              <p className="text-body-sm text-muted-foreground">
                Rekamanmu masih tersimpan di halaman ini. Jangan tutup atau muat ulang halaman sebelum terkirim.
              </p>
              <Button disabled={uploading} onClick={() => void upload()}>
                {uploading ? "Mengirim..." : "Kirim ulang"}
              </Button>
            </>
          ) : (
            <p className="text-body-sm text-muted-foreground">
              Jangan tutup halaman ini. Biasanya selesai dalam setengah menit.
            </p>
          )}
        </Card>
      );
    case "done":
      return attempt ? <DoneStep cekpahamId={initial.id} attempt={attempt} onAttempt={setAttempt} /> : null;
  }
}
