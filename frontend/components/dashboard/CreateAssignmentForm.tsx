"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BLOOM_LEVELS, bloomCode, bloomShortLabel } from "@/lib/bloom";
import { createAssignment, updateAssignment } from "@/lib/mutations";
import { DISPLAY_TIME_ZONE, formatDateTimeInput, parseDateTimeInput } from "@/lib/formatting";
import type { AssignmentSummary } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

// Jenjang tidak lagi diminta di sini. Tugas mewarisinya dari kelas, sehingga
// tidak mungkin ada tugas S2 di dalam kelas S1.
interface Props {
  classId: string;
  assignment?: AssignmentSummary;
}

export function CreateAssignmentForm({ classId, assignment }: Props) {
  const [title, setTitle] = useState(assignment?.title || "");
  const [instructions, setInstructions] = useState(assignment?.instructions || "");
  const [deadline, setDeadline] = useState(formatDateTimeInput(assignment?.deadline || null));
  const [expectedBloomLevel, setExpectedBloomLevel] = useState(assignment?.expected_bloom_level || 4);
  const targetLocked = !!assignment && assignment.submission_count > 0;
  const { pending, error, run, router } = useAction(
    "Gagal menyimpan tugas. Periksa isian lalu coba lagi.",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(
      () => {
        const input = {
          title: title.trim(),
          instructions: instructions.trim(),
          deadline: parseDateTimeInput(deadline),
          expected_bloom_level: expectedBloomLevel,
        };
        return assignment ? updateAssignment(assignment.id, input) : createAssignment(classId, input);
      },
      (created) => {
        router.push(`/dashboard/classes/${classId}?tab=tugas&assignment=${created.id}`);
        router.refresh();
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="assignment-title">Judul tugas</Label>
        <Input
          id="assignment-title"
          type="text"
          required
          maxLength={160}
          placeholder="Contoh: Esai: Dampak Revolusi Industri"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assignment-instructions">Instruksi untuk mahasiswa</Label>
        <Textarea
          id="assignment-instructions"
          rows={7}
          placeholder="Jelaskan tujuan, langkah pengerjaan, dan kriteria penilaian…"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assignment-deadline">Tenggat</Label>
        <Input
          id="assignment-deadline"
          type="datetime-local"
          required
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Zona waktu: {DISPLAY_TIME_ZONE}. Jam ini juga ditampilkan kepada mahasiswa.</p>
      </div>

      <div className="space-y-2">
        <Label>Target level kognitif (Taksonomi Bloom)</Label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BLOOM_LEVELS.map((level) => {
            const selected = level === expectedBloomLevel;
            return (
              <button
                key={level}
                type="button"
                disabled={targetLocked}
                onClick={() => setExpectedBloomLevel(level)}
                aria-pressed={selected}
                className={cn(
                  "rounded-xl border px-2 py-2.5 text-center transition disabled:cursor-not-allowed disabled:opacity-70",
                  selected
                    ? "border-transparent bg-primary text-primary-foreground shadow-soft"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40",
                )}
              >
                <span className="block text-xs font-semibold opacity-80">
                  {bloomCode(level)}
                </span>
                <span className="block text-body-sm font-semibold leading-tight">
                  {bloomShortLabel(level)}
                </span>
              </button>
            );
          })}
        </div>
        {targetLocked ? <p className="text-xs text-muted-foreground">Target Bloom tetap karena sudah ada pengumpulan. Judul, instruksi, dan tenggat masih dapat diperbarui.</p> : null}
      </div>

      {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row"><Button type="submit" disabled={pending} className="w-full rounded-xl sm:w-auto">
        {pending ? "Menyimpan..." : assignment ? "Simpan perubahan" : "Terbitkan tugas"}
      </Button><Button asChild variant="outline" className="rounded-xl"><Link href={`/dashboard/classes/${classId}?tab=tugas${assignment ? `&assignment=${assignment.id}` : ""}`}>Batal</Link></Button></div>
    </form>
  );
}
