"use client";

import { Mail } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/mutations";
import { useAction } from "@/lib/use-action";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { pending, error, run } = useAction("Gagal mengirim permintaan. Coba lagi sebentar lagi.");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const { ok } = await run(() => requestPasswordReset(email), () => undefined);
    if (ok) setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className="rounded-xl border border-border bg-muted/40 p-4 text-body text-foreground">
        Jika <strong>{email}</strong> terdaftar, tautan atur ulang kata sandi sudah dikirim. Cek kotak
        masuk dan folder spam. Tautan berlaku 30 menit.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-email">Email akun</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="reset-email"
            suppressHydrationWarning
            type="email"
            required
            autoComplete="email"
            placeholder="nama@kampus.ac.id"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending || !email} className="w-full" size="lg">
        {pending ? "Mengirim..." : "Kirim tautan atur ulang"}
      </Button>
    </form>
  );
}
