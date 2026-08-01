"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api-shared";
import { createClass } from "@/lib/mutations";
import type { EducationLevel } from "@/lib/types";

const EDUCATION_LEVELS: EducationLevel[] = ["SD", "SMP", "SMA-SMK"];

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-body shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring";

export function CreateClassForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("SMP");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const created = await createClass({
        name: name.trim(),
        subject: subject.trim(),
        education_level: educationLevel,
      });
      router.push(`/dashboard/classes/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Gagal menyimpan kelas. Periksa isian lalu coba lagi."),
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="class-name">Nama kelas</Label>
        <Input
          id="class-name"
          type="text"
          required
          maxLength={120}
          placeholder="Contoh: XI-B"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="class-subject">Mata pelajaran</Label>
        <Input
          id="class-subject"
          type="text"
          required
          maxLength={80}
          placeholder="Contoh: Sejarah"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="class-education-level">Jenjang</Label>
        <select
          id="class-education-level"
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
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? "Menyimpan..." : "Buat kelas"}
      </Button>
    </form>
  );
}
