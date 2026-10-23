"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmPasswordReset } from "@/lib/mutations";
import { useAction } from "@/lib/use-action";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const { pending, error, run } = useAction("Gagal mengatur ulang kata sandi.");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const { ok } = await run(() => confirmPasswordReset(token, password), () => undefined);
    if (ok) setDone(true);
  }

  if (!token) {
    return (
      <p role="alert" className="text-body text-danger">
        Tautan tidak lengkap. Buka tautan dari email sekali lagi, atau{" "}
        <Link href="/lupa-sandi" className="font-semibold underline">minta tautan baru</Link>.
      </p>
    );
  }

  if (done) {
    return (
      <div role="status" className="space-y-4">
        <p className="text-body text-foreground">Kata sandi diperbarui. Semua perangkat keluar otomatis.</p>
        <Button asChild size="lg" className="w-full">
          <Link href="/login">Masuk</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Kata sandi baru</Label>
        <Input
          id="new-password"
          suppressHydrationWarning
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-body-sm text-muted-foreground">
          Minimal 10 karakter, bukan kata sandi yang umum dipakai, dan tidak mirip email atau namamu.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}{" "}
          <Link href="/lupa-sandi" className="font-semibold underline">Minta tautan baru</Link>
        </p>
      ) : null}
      <Button type="submit" disabled={pending || password.length < 10} className="w-full" size="lg">
        {pending ? "Menyimpan..." : "Simpan kata sandi baru"}
      </Button>
    </form>
  );
}
