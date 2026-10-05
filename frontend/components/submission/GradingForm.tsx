"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gradeSubmission } from "@/lib/mutations";
import { useAction } from "@/lib/use-action";

interface Props {
  submissionId: string;
  initialGrade: number | null;
  initialFeedback: string;
}

export function GradingForm({ submissionId, initialGrade, initialFeedback }: Props) {
  const [grade, setGrade] = useState(initialGrade !== null ? String(initialGrade) : "");
  const [feedback, setFeedback] = useState(initialFeedback);
  const [message, setMessage] = useState<string | null>(null);
  const { pending, error, run } = useAction("Gagal menyimpan nilai. Coba lagi.");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const { ok } = await run(() =>
      gradeSubmission(submissionId, {
        grade: Number(grade),
        teacher_feedback: feedback.trim(),
      }),
    );
    if (ok) {
      setMessage("Nilai tersimpan. Mahasiswa dapat melihatnya di halaman tugas.");
    }
  }

  return (
    <Card className="campus-card p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3eeea] text-[#28675f]"><ClipboardCheck className="h-5 w-5" /></span><div><h2 className="font-extrabold">Nilai & umpan balik</h2><p className="mt-0.5 text-xs text-muted-foreground">Hasil akan terlihat oleh mahasiswa.</p></div></div>
        <div className="space-y-1.5">
          <Label htmlFor="grade">Nilai (0-100)</Label>
          <Input
            id="grade"
            type="number"
            required
            min={0}
            max={100}
            step={1}
            placeholder="0–100"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feedback">Umpan balik untuk mahasiswa (opsional)</Label>
          <Textarea
            id="feedback"
            rows={5}
            placeholder="Tuliskan hal yang sudah baik dan saran perbaikan…"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </div>
        {message ? <p role="status" className="text-body-sm text-[#28675f]">{message}</p> : null}
        {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full rounded-xl">
          {pending ? "Menyimpan..." : "Simpan nilai"}
        </Button>
      </form>
    </Card>
  );
}
