"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-shared";
import { submitAnswer, type ProgressSample } from "@/lib/mutations";

const MIN_LENGTH = 50;

// Jarak antar cuplikan jumlah kata. Cukup rapat untuk memisahkan mengetik dari
// menempel, cukup jarang agar satu pengerjaan dua jam tetap di bawah batas
// yang diterima backend.
const SAMPLE_INTERVAL_MS = 30_000;
const MAX_SAMPLES = 240;

type Mode = "create" | "revise";

interface Props {
  assignmentId: string;
  backHref: string;
  mode?: Mode;
  initialText?: string;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

const COPY: Record<Mode, { submit: string; loading: string; done: string }> = {
  create: {
    submit: "Submit & Analyze",
    loading: "Mengumpulkan...",
    done: "Jawabanmu berhasil dikumpulkan. Terima kasih.",
  },
  revise: {
    submit: "Simpan Revisi",
    loading: "Menyimpan...",
    done: "Revisi jawabanmu berhasil disimpan.",
  },
};

export function SubmitAnswerForm({
  assignmentId,
  backHref,
  mode = "create",
  initialText = "",
}: Props) {
  const router = useRouter();
  // Waktu mulai direkam sekali saat form dirender, dikirim sebagai started_at.
  const startedAtRef = useRef(new Date().toISOString());
  // Jejak pertumbuhan kata. Disimpan di ref, bukan state, karena tidak pernah
  // dirender dan tidak boleh memicu render ulang tiap tiga puluh detik.
  const progressRef = useRef<ProgressSample[]>([]);
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const copy = COPY[mode];

  // Teks terbaru disimpan di ref supaya pewaktu di bawah tidak perlu dipasang
  // ulang setiap ketikan, yang akan mengacak jarak antar cuplikan.
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    // Cuplikan dasar diambil segera, bukan menunggu selang pertama. Tanpa ini,
    // menempel dalam tiga puluh detik pertama membuat pengamatan perdana sudah
    // memuat teks penuh, dan jejaknya terbaca datar sejak awal.
    progressRef.current.push({
      at: new Date().toISOString(),
      word_count: countWords(textRef.current),
    });
    const timer = setInterval(() => {
      if (progressRef.current.length >= MAX_SAMPLES) return;
      progressRef.current.push({
        at: new Date().toISOString(),
        word_count: countWords(textRef.current),
      });
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await submitAnswer(assignmentId, {
        text_answer: text.trim(),
        started_at: startedAtRef.current,
        // Hanya dikirim saat mengarang dari nol. Pada mode revisi kotak sudah
        // terisi jawaban sebelumnya, sehingga cuplikan dasar mencatat ratusan
        // kata sejak detik nol dan backend akan membacanya sebagai lonjakan.
        // Backend memang mengabaikan progress pada jalur revisi, tetapi lebih
        // jujur tidak mengirim data yang tidak bisa ditafsirkan.
        //
        // Cuplikan terakhir diambil saat menekan tombol, supaya penambahan
        // setelah cuplikan berkala terakhir tidak hilang dari jejak.
        progress:
          mode === "create"
            ? [
                ...progressRef.current,
                { at: new Date().toISOString(), word_count: countWords(text) },
              ].slice(0, MAX_SAMPLES)
            : undefined,
      });
      setSubmitted(true);
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "Gagal menyimpan jawaban. Coba lagi."));
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Card className="space-y-4 p-8 text-center shadow-soft">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <p className="text-body-lg font-semibold text-foreground">{copy.done}</p>
        <Button asChild>
          <Link href={backHref}>Kembali ke daftar tugas</Link>
        </Button>
      </Card>
    );
  }

  const tooShort = text.trim().length < MIN_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card className="overflow-hidden border-2 border-primary/40 shadow-soft">
        <Textarea
          id="answer"
          rows={12}
          required
          placeholder="Tulis jawabanmu di sini..."
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="rounded-none border-0 bg-transparent px-5 py-4 text-body-lg focus-visible:ring-0"
        />
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3 text-body-sm text-muted-foreground">
          <span>Minimal {MIN_LENGTH} karakter</span>
          <span>{countWords(text)} kata &middot; {text.trim().length} karakter</span>
        </div>
      </Card>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={loading || tooShort} size="lg" className="w-full sm:w-auto">
        <Sparkles className="h-4 w-4" />
        {loading ? copy.loading : copy.submit}
      </Button>
    </form>
  );
}
