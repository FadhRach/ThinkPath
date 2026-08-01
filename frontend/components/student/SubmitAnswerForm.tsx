"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-shared";
import { submitAnswer } from "@/lib/mutations";

const MIN_LENGTH = 50;

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
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const copy = COPY[mode];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await submitAnswer(assignmentId, {
        text_answer: text.trim(),
        started_at: startedAtRef.current,
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
