"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BLOOM_LEVELS, bloomCode, bloomShortLabel } from "@/lib/bloom";
import { createAssignment } from "@/lib/mutations";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

// Jenjang tidak lagi diminta di sini. Tugas mewarisinya dari kelas, sehingga
// tidak mungkin ada tugas S2 di dalam kelas S1.
interface Props {
  classId: string;
}

export function CreateAssignmentForm({ classId }: Props) {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [deadline, setDeadline] = useState("");
  const [expectedBloomLevel, setExpectedBloomLevel] = useState(4);
  const { pending, error, run, router } = useAction(
    "Gagal menyimpan tugas. Periksa isian lalu coba lagi.",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(
      () =>
        createAssignment(classId, {
          title: title.trim(),
          instructions: instructions.trim(),
          deadline: new Date(deadline).toISOString(),
          expected_bloom_level: expectedBloomLevel,
        }),
      (created) => {
        router.push(`/dashboard/classes/${classId}?assignment=${created.id}`);
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
          rows={4}
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
                onClick={() => setExpectedBloomLevel(level)}
                aria-pressed={selected}
                className={cn(
                  "rounded-xl border px-2 py-2.5 text-center transition",
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
      </div>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Menyimpan..." : "Terbitkan tugas"}
      </Button>
    </form>
  );
}
