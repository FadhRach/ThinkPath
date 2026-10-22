import { Clock, Headphones, Mic, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatClockHHMM, formatDate } from "@/lib/formatting";
import type { StudentCekPaham } from "@/lib/types";

const STEPS = [
  { icon: Mic, text: "Izinkan mikrofon, lalu coba bicara sebentar untuk memastikan suaramu terbaca." },
  { icon: Clock, text: "Saat kamu menekan Mulai, satu pertanyaan tampil dan mikrofon langsung merekam." },
  { icon: Headphones, text: "Jawab langsung dengan suara. Tidak ada kolom ketik, dan waktunya singkat." },
  { icon: ShieldCheck, text: "Setelah selesai kamu bisa membaca transkripnya dan melapor bila ada yang salah." },
];

export function IntroStep({ cekpaham, onNext }: { cekpaham: StudentCekPaham; onNext: () => void }) {
  return (
    <Card className="space-y-5 p-6 shadow-soft">
      <div>
        <h2 className="text-lg font-bold text-foreground">Cara kerjanya</h2>
        <p className="text-body-sm text-muted-foreground">
          Dosen ingin mendengar kamu menjelaskan jawaban yang kamu kumpulkan di tugas{" "}
          <strong className="text-foreground">{cekpaham.assignment_title}</strong>. Ini bukan ujian
          hafalan: jelaskan dengan kata-katamu sendiri.
        </p>
      </div>

      <ol className="space-y-3">
        {STEPS.map(({ icon: Icon, text }, index) => (
          <li key={text} className="flex items-start gap-3 text-body-sm text-foreground">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-caption font-bold text-primary">
              {index + 1}
            </span>
            <span className="flex items-start gap-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {text}
            </span>
          </li>
        ))}
      </ol>

      <dl className="grid gap-3 rounded-xl bg-secondary/40 p-4 text-body-sm sm:grid-cols-2">
        <div>
          <dt className="text-caption text-muted-foreground">Waktu menjawab</dt>
          <dd className="font-semibold text-foreground">{cekpaham.answer_seconds} detik</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Dapat dikerjakan sampai</dt>
          <dd className="font-semibold text-foreground">
            {formatDate(cekpaham.window_end)} pukul {formatClockHHMM(cekpaham.window_end)}
          </dd>
        </div>
      </dl>

      <div className="rounded-xl border border-border p-4 text-body-sm">
        <p className="caption-eyebrow mb-1 text-primary">Contoh (bukan pertanyaan sebenarnya)</p>
        <p className="text-foreground">
          &ldquo;Pada jawabanmu kamu memilih pendekatan A. Jelaskan alasannya.&rdquo;
        </p>
        <p className="mt-1 text-muted-foreground">
          Jawaban yang baik menyebut alasan dan contoh dari yang kamu kerjakan, bukan hanya istilah.
        </p>
      </div>

      <Button onClick={onNext}>Lanjut ke tes mikrofon</Button>
    </Card>
  );
}
