"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/mutations";
import type { EducationLevel, Profile } from "@/lib/types";
import { useAction } from "@/hooks/use-action";

const LEVELS: EducationLevel[] = ["D3", "S1", "S2", "S3"];

export function ProfileForm({ profile }: { profile: Profile }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [level, setLevel] = useState<string>(profile.education_level ?? "");
  const [saved, setSaved] = useState(false);
  const { pending, error, setError, run } = useAction("Gagal menyimpan perubahan.", {
    successMessage: "Profil diperbarui.",
  });

  const dirty =
    displayName !== (profile.display_name ?? "") || level !== (profile.education_level ?? "");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed === "") {
      setError("Nama tidak boleh kosong.");
      return;
    }

    setSaved(false);
    // Nama tampil dipakai di TopNav dan tabel submission; refresh bawaan run()
    // mengambil ulang semua segmen server yang menampilkannya.
    const { ok } = await run(() =>
      updateProfile({
        display_name: trimmed,
        ...(level ? { education_level: level as EducationLevel } : {}),
      }),
    );
    if (ok) setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="display_name">Nama tampil</Label>
        <Input
          id="display_name"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setSaved(false);
          }}
          maxLength={120}
          placeholder="Nama lengkap"
        />
        <p className="text-caption text-muted-foreground">
          {profile.role === "teacher"
            ? "Nama ini yang dilihat mahasiswa pada kelas yang Anda ampu."
            : "Nama ini yang dilihat dosen pada daftar submission."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="education_level">Jenjang</Label>
        <NativeSelect
          id="education_level"
          value={level}
          onChange={(event) => {
            setLevel(event.target.value);
            setSaved(false);
          }}
        >
          <option value="">Belum diisi</option>
          {LEVELS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </NativeSelect>
        <p className="text-caption text-muted-foreground">
          Jenjang pribadi ini terpisah dari jenjang kelas. Analisis memakai jenjang kelas, bukan
          yang ini.
        </p>
      </div>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      {saved && !dirty ? <p className="text-body-sm text-success">Perubahan tersimpan.</p> : null}

      <Button type="submit" disabled={pending || !dirty}>
        {pending ? "Menyimpan..." : "Simpan perubahan"}
      </Button>
    </form>
  );
}
