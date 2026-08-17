"use client";

import { useState } from "react";

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
    <Card className="p-5 shadow-soft">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="caption-eyebrow text-primary">Penilaian</p>
        <div className="space-y-1.5">
          <Label htmlFor="grade">Nilai (0-100)</Label>
          <Input
            id="grade"
            type="number"
            required
            min={0}
            max={100}
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="feedback">Umpan balik untuk mahasiswa (opsional)</Label>
          <Textarea
            id="feedback"
            rows={3}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </div>
        {message ? <p className="text-body-sm text-primary">{message}</p> : null}
        {error ? <p className="text-body-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Menyimpan..." : "Simpan nilai"}
        </Button>
      </form>
    </Card>
  );
}
