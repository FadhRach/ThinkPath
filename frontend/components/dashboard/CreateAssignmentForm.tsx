"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-shared";
import { BLOOM_LEVELS, bloomCode, bloomShortLabel } from "@/lib/bloom";
import { createAssignment } from "@/lib/mutations";
import type { EducationLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const EDUCATION_LEVELS: EducationLevel[] = ["SD", "SMP", "SMA-SMK"];

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-body shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring";

interface Props {
  classId: string;
  defaultEducationLevel: EducationLevel;
}

export function CreateAssignmentForm({ classId, defaultEducationLevel }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [deadline, setDeadline] = useState("");
  const [expectedBloomLevel, setExpectedBloomLevel] = useState(4);
  const [educationLevel, setEducationLevel] =
    useState<EducationLevel>(defaultEducationLevel);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const created = await createAssignment(classId, {
        title: title.trim(),
        instructions: instructions.trim(),
        deadline: new Date(deadline).toISOString(),
        expected_bloom_level: expectedBloomLevel,
        education_level: educationLevel,
      });
      router.push(`/dashboard/classes/${classId}?assignment=${created.id}`);
      router.refresh();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Gagal menyimpan tugas. Periksa isian lalu coba lagi."),
      );
      setLoading(false);
    }
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
        <Label htmlFor="assignment-instructions">Instruksi untuk siswa</Label>
        <Textarea
          id="assignment-instructions"
          rows={4}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="space-y-1.5">
          <Label htmlFor="assignment-education-level">Jenjang</Label>
          <select
            id="assignment-education-level"
            value={educationLevel}
            onChange={(event) => setEducationLevel(event.target.value as EducationLevel)}
            className={SELECT_CLASS}
          >
            {EDUCATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
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
      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? "Menyimpan..." : "Terbitkan tugas"}
      </Button>
    </form>
  );
}
