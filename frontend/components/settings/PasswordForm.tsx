"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/mutations";
import { useAction } from "@/lib/use-action";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);
  const { pending, error, run } = useAction("Gagal mengganti kata sandi.");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setDone(false);
    const { ok } = await run(() => changePassword(current, next), () => undefined);
    if (ok) {
      setCurrent("");
      setNext("");
      setDone(true);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <div>
        <h2 className="font-bold text-foreground">Kata sandi</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Minimal 10 karakter, bukan kata sandi yang umum dipakai, dan tidak mirip email atau namamu.
          Perangkat lain akan keluar otomatis.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Kata sandi saat ini</Label>
        <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} maxLength={128} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Kata sandi baru</Label>
        <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} maxLength={128} />
      </div>
      {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
      {done ? <p role="status" className="text-body-sm text-success">Kata sandi diganti.</p> : null}
      <Button type="submit" disabled={pending || !current || next.length < 10}>
        {pending ? "Menyimpan..." : "Ganti kata sandi"}
      </Button>
    </form>
  );
}
