"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClass } from "@/lib/mutations";
import type { EducationLevel } from "@/lib/types";
import { useAction } from "@/lib/use-action";

const EDUCATION_LEVELS: EducationLevel[] = ["D3", "S1", "S2", "S3"];

// Semester penyelenggaraan kelas, bukan semester mahasiswa. Sampai 14 untuk
// menampung program yang lebih panjang dari delapan semester.
const SEMESTERS = Array.from({ length: 14 }, (_, index) => index + 1);

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-body shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring";

export function CreateClassForm() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("S1");
  const [programStudi, setProgramStudi] = useState("");
  const [semester, setSemester] = useState("");
  const { pending, error, run, router } = useAction(
    "Gagal menyimpan kelas. Periksa isian lalu coba lagi.",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(
      () =>
        createClass({
          name: name.trim(),
          subject: subject.trim(),
          education_level: educationLevel,
          program_studi: programStudi.trim(),
          // Kosong dikirim sebagai null, bukan 0, karena kelas lintas semester
          // memang boleh tidak punya semester.
          semester: semester === "" ? null : Number(semester),
        }),
      (created) => {
        router.push(`/dashboard/classes/${created.id}`);
        router.refresh();
      },
    );
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
          placeholder="Contoh: Metodologi Penelitian A"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="class-subject">Mata kuliah</Label>
        <Input
          id="class-subject"
          type="text"
          required
          maxLength={80}
          placeholder="Contoh: Metodologi Penelitian"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="class-program-studi">Program studi</Label>
        <Input
          id="class-program-studi"
          type="text"
          maxLength={120}
          placeholder="Contoh: Sistem Informasi"
          value={programStudi}
          onChange={(event) => setProgramStudi(event.target.value)}
        />
        <p className="text-caption text-muted-foreground">
          Boleh dikosongkan untuk mata kuliah umum atau kelas lintas prodi.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
        <div className="space-y-1.5">
          <Label htmlFor="class-semester">Semester</Label>
          <select
            id="class-semester"
            value={semester}
            onChange={(event) => setSemester(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Tidak ditentukan</option>
            {SEMESTERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Menyimpan..." : "Buat kelas"}
      </Button>
    </form>
  );
}
