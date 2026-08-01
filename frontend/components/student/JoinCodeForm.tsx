"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-shared";
import { joinClass } from "@/lib/mutations";

export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const result = await joinClass(code.trim().toUpperCase());
      setMessage(
        result.created
          ? `Berhasil bergabung ke kelas ${result.class.name}.`
          : `Kamu sudah menjadi anggota kelas ${result.class.name}.`,
      );
      setCode("");
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "Gagal bergabung. Periksa kode kelasnya."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          required
          maxLength={8}
          placeholder="Kode kelas, contoh: THINK-XIB"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="uppercase"
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? "Bergabung..." : "Gabung kelas"}
        </Button>
      </form>
      {message ? <p className="text-body-sm text-primary">{message}</p> : null}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
