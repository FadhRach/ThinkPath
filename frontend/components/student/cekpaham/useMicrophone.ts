"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  DEAD_INPUT_LEVEL,
  SPEECH_LEVEL,
  pickRecordingMime,
  rmsLevel,
} from "@/lib/cekpaham";

export type MicStatus = "idle" | "requesting" | "ready" | "denied" | "unsupported" | "error" | "lost";
export type LostReason = "track_ended" | "dead_input";

/** Konteks dari klien untuk dosen. Tidak pernah diskor. */
export interface MicEvents {
  visibility_changes: number;
  blur_count: number;
  device_changes: number;
  mic_errors: number;
  silent_seconds: number;
}

const METER_INTERVAL_MS = 100;
// Sinyal nyaris nol selama ini berarti mikrofon mati atau dibisukan perangkat.
// Sunyi biasa (sedang berpikir) tetap punya derau ruangan di atas ambang ini.
const DEAD_INPUT_MS = 5000;
const AUDIO_BITS_PER_SECOND = 32_000;
const FULL_TIMESLICE_MS = 1000;

/**
 * Satu mikrofon, dua perekam:
 * - utuh: seluruh jawaban, dikirim saat selesai (sumber transkrip yang dinilai);
 * - potongan: perekam yang dimulai ulang tiap beberapa detik, supaya tiap
 *   potongan berdiri sendiri dan bisa ditranskripsi untuk caption sementara
 *   (potongan `timeslice` biasa tidak bisa didekode tanpa potongan pertama).
 */
export function useMicrophone(onLost?: (reason: LostReason) => void) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const meterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string | undefined>(undefined);
  const onLostRef = useRef(onLost);
  onLostRef.current = onLost;

  const peakRef = useRef(0);
  const deadMsRef = useRef(0);
  const monitoringRef = useRef(false);
  const lostRef = useRef(false);
  const eventsRef = useRef<MicEvents>({
    visibility_changes: 0,
    blur_count: 0,
    device_changes: 0,
    mic_errors: 0,
    silent_seconds: 0,
  });

  const fullRecorderRef = useRef<MediaRecorder | null>(null);
  const fullChunksRef = useRef<Blob[]>([]);
  const segmentRecorderRef = useRef<MediaRecorder | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentsActiveRef = useRef(false);

  const markLost = useCallback((reason: LostReason) => {
    if (lostRef.current) return;
    lostRef.current = true;
    eventsRef.current.mic_errors += 1;
    setStatus("lost");
    onLostRef.current?.(reason);
  }, []);

  const newRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) throw new Error("Mikrofon belum siap.");
    return new MediaRecorder(stream, {
      mimeType: mimeRef.current,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
  }, []);

  const release = useCallback(() => {
    segmentsActiveRef.current = false;
    monitoringRef.current = false;
    if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
    if (meterRef.current) clearInterval(meterRef.current);
    for (const recorder of [segmentRecorderRef.current, fullRecorderRef.current]) {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void contextRef.current?.close();
    streamRef.current = null;
    contextRef.current = null;
    meterRef.current = null;
  }, []);

  const request = useCallback(async (): Promise<boolean> => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return false;
    }
    const mime = pickRecordingMime((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (mime === undefined) {
      setStatus("unsupported");
      return false;
    }
    mimeRef.current = mime;
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      lostRef.current = false;
      stream.getAudioTracks().forEach((track) => {
        track.addEventListener("ended", () => markLost("track_ended"));
      });

      const context = new AudioContext();
      await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      contextRef.current = context;

      const samples = new Uint8Array(analyser.fftSize);
      meterRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        const current = rmsLevel(samples);
        setLevel(current);
        peakRef.current = Math.max(peakRef.current, current);
        if (!monitoringRef.current) return;
        if (current < SPEECH_LEVEL) eventsRef.current.silent_seconds += METER_INTERVAL_MS / 1000;
        deadMsRef.current = current < DEAD_INPUT_LEVEL ? deadMsRef.current + METER_INTERVAL_MS : 0;
        if (deadMsRef.current >= DEAD_INPUT_MS) markLost("dead_input");
      }, METER_INTERVAL_MS);

      setStatus("ready");
      return true;
    } catch (error) {
      const denied = error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name);
      setStatus(denied ? "denied" : "error");
      return false;
    }
  }, [markLost]);

  /** Mulai mengawasi mikrofon mati dan menghitung diam; dipanggil saat sesi sungguhan mulai. */
  const startMonitoring = useCallback(() => {
    deadMsRef.current = 0;
    monitoringRef.current = true;
  }, []);

  const startFull = useCallback(() => {
    fullChunksRef.current = [];
    const recorder = newRecorder();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) fullChunksRef.current.push(event.data);
    };
    recorder.start(FULL_TIMESLICE_MS);
    fullRecorderRef.current = recorder;
  }, [newRecorder]);

  /** Hentikan perekam utuh dan kembalikan audionya (null bila belum ada data). */
  const stopFull = useCallback((): Promise<Blob | null> => {
    const recorder = fullRecorderRef.current;
    const done = () =>
      fullChunksRef.current.length > 0
        ? new Blob(fullChunksRef.current, { type: recorder?.mimeType || mimeRef.current })
        : null;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(done());
    return new Promise((resolve) => {
      recorder.onstop = () => resolve(done());
      recorder.stop();
    });
  }, []);

  /** Potongan berdiri sendiri; yang tanpa suara (di bawah ambang bicara) tidak dikirim. */
  const startSegments = useCallback(
    (onSegment: (blob: Blob) => void, intervalMs: number) => {
      segmentsActiveRef.current = true;
      const cycle = () => {
        if (!segmentsActiveRef.current) return;
        const recorder = newRecorder();
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        peakRef.current = 0;
        recorder.start();
        segmentRecorderRef.current = recorder;
        segmentTimerRef.current = setTimeout(() => {
          const heardSpeech = peakRef.current >= SPEECH_LEVEL;
          recorder.onstop = () => {
            if (heardSpeech && chunks.length > 0) {
              onSegment(new Blob(chunks, { type: recorder.mimeType }));
            }
          };
          recorder.stop();
          cycle();
        }, intervalMs);
      };
      cycle();
    },
    [newRecorder],
  );

  const stopSegments = useCallback(() => {
    segmentsActiveRef.current = false;
    if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
    const recorder = segmentRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const getEvents = useCallback(
    (): MicEvents => ({ ...eventsRef.current, silent_seconds: Math.round(eventsRef.current.silent_seconds) }),
    [],
  );

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) eventsRef.current.visibility_changes += 1;
    };
    const onBlur = () => {
      eventsRef.current.blur_count += 1;
    };
    const onDevices = () => {
      eventsRef.current.device_changes += 1;
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    navigator.mediaDevices?.addEventListener?.("devicechange", onDevices);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDevices);
      release();
    };
  }, [release]);

  return {
    status,
    level,
    request,
    startMonitoring,
    startFull,
    stopFull,
    startSegments,
    stopSegments,
    getEvents,
    release,
  };
}

export type Microphone = ReturnType<typeof useMicrophone>;
