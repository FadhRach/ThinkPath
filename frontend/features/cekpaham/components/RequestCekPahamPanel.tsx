"use client";

import { Mic } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatClockHHMM,
  formatDate,
  formatDateTimeInput,
  parseDateTimeInput,
} from "@/lib/formatting";
import { createCekPaham } from "@/lib/mutations";
import type { CekPahamLanguage, CekPahamRow } from "@/lib/types";
import { useAction } from "@/hooks/use-action";

import { AttemptStatusBadge, BandBadge, PhaseBadge } from "./CekPahamBadges";
import { CancelCekPahamButton } from "./CekPahamActions";

const DURATIONS = [30, 45, 60, 90, 120];
const DEFAULT_WINDOW_HOURS = 48;

function inHours(hours: number): string {
  return formatDateTimeInput(new Date(Date.now() + hours * 3_600_000).toISOString());
}

/**
 * Minta mahasiswa menjelaskan jawabannya dengan suara.
 *
 * Skor hasilnya hanya saran dan tampil berdampingan dengan bukti lain; nilai
 * tugas tetap Anda isi sendiri. Satu permintaan aktif per jawaban.
 */
export function RequestCekPahamPanel({
  submissionId,
  items,
}: {
  submissionId: string;
  items: CekPahamRow[];
}) {
  const active = items.find((item) => item.status === "active");
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState<CekPahamLanguage>("id");
  const [seconds, setSeconds] = useState(45);
  const [start, setStart] = useState(() => inHours(0));
  const [end, setEnd] = useState(() => inHours(DEFAULT_WINDOW_HOURS));
  const { pending, error, run } = useAction("Gagal membuat Cek Paham. Coba lagi.", {
    successMessage: "Cek Paham dibuat.",
  });

  return (
    <Card variant="raised" className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-brand-ink">
          <Mic className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="caption-eyebrow text-brand-ink">Cek Paham</p>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Tes lisan singkat: mahasiswa menjawab satu soal Anda dengan suara, tanpa mengetik.
            Hasilnya berupa transkrip, audio, dan saran skor yang bisa Anda periksa.
          </p>
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 space-y-1">
                <Link
                  href={`/dashboard/cekpaham/${item.id}`}
                  className="line-clamp-2 font-medium text-foreground hover:text-brand-ink"
                >
                  {item.question_text}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <PhaseBadge phase={item.phase} />
                  {item.attempt ? <AttemptStatusBadge status={item.attempt.status} /> : null}
                  {item.attempt?.ai_band ? <BandBadge band={item.attempt.ai_band} /> : null}
                  <span className="text-caption text-muted-foreground">
                    sampai {formatDate(item.window_end)} {formatClockHHMM(item.window_end)}
                  </span>
                </div>
              </div>
              {item.status === "active" ? <CancelCekPahamButton id={item.id} /> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {active ? (
        <p className="text-body-sm text-muted-foreground">
          Sudah ada Cek Paham aktif untuk jawaban ini. Batalkan dulu bila ingin membuat soal baru.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              createCekPaham(submissionId, {
                question_text: question.trim(),
                language,
                answer_seconds: seconds,
                window_start: parseDateTimeInput(start),
                window_end: parseDateTimeInput(end),
              }),
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cekpaham-question">Soal konfirmasi</Label>
            <Textarea
              id="cekpaham-question"
              rows={3}
              minLength={10}
              maxLength={1000}
              required
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Pada jawabanmu kamu memilih pendekatan X. Jelaskan alasannya."
            />
            <p className="text-caption text-muted-foreground">
              Soal terbaik merujuk bagian tertentu dari jawaban mahasiswa. Soal pengetahuan umum
              (&ldquo;sebutkan operator aritmatika di C&rdquo;) bisa dijawab siapa pun yang pernah
              belajar topiknya, jadi lemah sebagai bukti kepemilikan karya.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cekpaham-language">Bahasa jawaban</Label>
              <NativeSelect
                id="cekpaham-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value as CekPahamLanguage)}
              >
                <option value="id">Indonesia</option>
                <option value="en">Inggris</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cekpaham-seconds">Waktu menjawab</Label>
              <NativeSelect
                id="cekpaham-seconds"
                value={seconds}
                onChange={(event) => setSeconds(Number(event.target.value))}
              >
                {DURATIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} detik
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cekpaham-start">Dibuka</Label>
              <Input
                id="cekpaham-start"
                type="datetime-local"
                required
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cekpaham-end">Ditutup</Label>
              <Input
                id="cekpaham-end"
                type="datetime-local"
                required
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </div>
          </div>

          <Button type="submit" disabled={pending || question.trim().length < 10}>
            {pending ? "Membuat..." : "Minta Cek Paham"}
          </Button>
          {error ? (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </Card>
  );
}
