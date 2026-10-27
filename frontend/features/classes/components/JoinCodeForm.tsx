"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinClass } from "@/lib/mutations";
import { notify } from "@/lib/notify";
import { useAction } from "@/hooks/use-action";

export function JoinCodeForm() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  // Tanpa toast sukses bawaan: hasilnya bisa "sudah anggota", jadi pesannya mengikuti respons.
  const { pending, error, run } = useAction("Gagal bergabung. Periksa kode kelasnya.");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const { result } = await run(() => joinClass(code.trim().toUpperCase()));
    if (result) {
      const text = result.created
        ? `Berhasil bergabung ke kelas ${result.class.name}.`
        : `Kamu sudah menjadi anggota kelas ${result.class.name}.`;
      if (result.created) notify.success(text);
      else notify.info(text);
      setMessage(text);
      setCode("");
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex">
        <label htmlFor="join-class-code" className="sr-only">
          Kode kelas
        </label>
        <Input
          id="join-class-code"
          type="text"
          required
          maxLength={8}
          placeholder="Kode kelas"
          aria-label="Kode kelas"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="h-10 min-w-0 rounded-r-none bg-card uppercase placeholder:normal-case"
        />
        <Button type="submit" disabled={pending} className="h-10 w-fit shrink-0 rounded-l-none">
          {pending ? "Bergabung..." : "Gabung kelas"}
        </Button>
      </form>
      {message ? <p className="text-body-sm text-brand-ink">{message}</p> : null}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
