"use client";

import { Play, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/lib/api-shared";
import { readAuthTokenFromBrowser } from "@/lib/auth-token";
import { cancelCekPaham, reprocessCekPaham, resolveCekPahamReport } from "@/lib/mutations";
import { useAction } from "@/lib/use-action";

export function CancelCekPahamButton({ id }: { id: string }) {
  const { pending, error, run } = useAction("Gagal membatalkan. Coba lagi.");
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Batalkan Cek Paham ini? Mahasiswa tidak bisa mengerjakannya lagi.")) {
            void run(() => cancelCekPaham(id));
          }
        }}
      >
        <XCircle className="h-4 w-4" aria-hidden="true" />
        {pending ? "Membatalkan..." : "Batalkan"}
      </Button>
      {error ? <span role="alert" className="text-body-sm text-danger">{error}</span> : null}
    </span>
  );
}

export function ReprocessCekPahamButton({ id, attemptNumber }: { id: string; attemptNumber: number }) {
  const { pending, error, run } = useAction("Gagal memproses ulang. Coba lagi sebentar lagi.");
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => run(() => reprocessCekPaham(id, attemptNumber))}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        {pending ? "Memproses ulang..." : "Proses ulang"}
      </Button>
      {error ? <span role="alert" className="text-body-sm text-danger">{error}</span> : null}
    </span>
  );
}

/** Audio dimuat lewat fetch ber-token lalu diputar dari blob: tidak ada URL statis yang bisa dibagikan. */
export function CekPahamAudio({ id, attemptNumber }: { id: string; attemptNumber: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setPending(true);
    setError(null);
    try {
      const response = await fetchApi(
        `/api/cekpaham/${id}/attempts/${attemptNumber}/audio`,
        {},
        readAuthTokenFromBrowser(),
      );
      if (!response.ok) throw new Error(String(response.status));
      setSrc(URL.createObjectURL(await response.blob()));
    } catch {
      setError("Audio tidak dapat dimuat (mungkin sudah melewati masa simpan 30 hari).");
    } finally {
      setPending(false);
    }
  }

  if (src) return <audio controls autoPlay src={src} className="w-full" />;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={load}>
        <Play className="h-4 w-4" aria-hidden="true" />
        {pending ? "Memuat audio..." : "Putar audio jawaban"}
      </Button>
      {error ? <span role="alert" className="text-body-sm text-danger">{error}</span> : null}
    </span>
  );
}

/** Dosen menanggapi laporan: tolak (hasil tetap), atau izinkan mahasiswa mengulang. */
export function ReportResolver({ reportId }: { reportId: string }) {
  const [note, setNote] = useState("");
  const { pending, error, run } = useAction("Gagal menyimpan tanggapan. Coba lagi.");
  const respond = (resolution: "dismissed" | "grant_retry") =>
    run(() => resolveCekPahamReport(reportId, { resolution, response_note: note.trim() }));

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`resolve-${reportId}`}>Tanggapan untuk mahasiswa (opsional)</Label>
        <Textarea
          id={`resolve-${reportId}`}
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Misalnya: Transkrip sudah saya cocokkan dengan audio dan sesuai."
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => respond("dismissed")}>
          Tolak laporan
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={() => respond("grant_retry")}>
          Izinkan mengulang
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">
        &ldquo;Izinkan mengulang&rdquo; membatalkan sesi ini dan membuka kesempatan baru dengan soal yang
        sama; jendela waktunya diperpanjang bila perlu.
      </p>
      {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
