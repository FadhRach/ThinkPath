"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-shared";
import { gradeSubmission } from "@/lib/mutations";

interface Props {
  submissionId: string;
  initialGrade: number | null;
  initialFeedback: string;
}

export function GradingForm({ submissionId, initialGrade, initialFeedback }: Props) {
  const router = useRouter();
  const [grade, setGrade] = useState(initialGrade !== null ? String(initialGrade) : "");
  const [feedback, setFeedback] = useState(initialFeedback);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await gradeSubmission(submissionId, {
        grade: Number(grade),
        teacher_feedback: feedback.trim(),
      });
      setMessage("Nilai tersimpan. Siswa dapat melihatnya di halaman tugas.");
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "Gagal menyimpan nilai. Coba lagi."));
    } finally {
      setLoading(false);
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
          <Label htmlFor="feedback">Umpan balik untuk siswa (opsional)</Label>
          <Textarea
            id="feedback"
            rows={3}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </div>
        {message ? <p className="text-body-sm text-primary">{message}</p> : null}
        {error ? <p className="text-body-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Menyimpan..." : "Simpan nilai"}
        </Button>
      </form>
    </Card>
  );
}
