"use client";

import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useState } from "react";

import { RoleSelector } from "@/components/auth/RoleSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homePathForRole, login, register } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { useAction } from "@/lib/use-action";

type Mode = "login" | "register";

interface Props {
  mode: Mode;
}

const ROLE_LABEL: Record<Role, string> = {
  student: "Mahasiswa",
  teacher: "Dosen",
};

export function EmailPasswordForm({ mode }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { pending, error, run, router } = useAction(
    "Gagal memproses. Periksa isian lalu coba lagi.",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Cookie token sudah ditulis sebelum navigasi, jadi render pertama tujuan
    // sudah login — tidak perlu router.refresh() yang me-render dua kali.
    await run(
      () =>
        mode === "login"
          ? login(email, password)
          : register({
              email,
              password,
              display_name: displayName.trim(),
              role,
            }),
      (result) => router.replace(homePathForRole(result.profile.role)),
    );
  }

  const submitLabel =
    mode === "login"
      ? `Masuk sebagai ${ROLE_LABEL[role]}`
      : `Daftar sebagai ${ROLE_LABEL[role]}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <RoleSelector value={role} onChange={setRole} />

      {mode === "register" ? (
        <div className="space-y-1.5">
          <Label htmlFor="display-name">Nama lengkap</Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="display-name"
              type="text"
              required
              maxLength={120}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email kampus</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Kata sandi</Label>
          {mode === "login" ? (
            <span className="text-body-sm font-semibold text-primary">
              Lupa kata sandi?
            </span>
          ) : null}
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="px-9"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "Memproses..." : submitLabel}
      </Button>
    </form>
  );
}
