"use client";

import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RoleSelector } from "@/features/auth/components/RoleSelector";
import { PolicyConsent } from "@/features/privacy/components/PolicyConsent";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/shared/FormField";
import { IconInput } from "@/components/shared/IconInput";
import { homePathForRole, login, register } from "@/lib/mutations";
import type { Role } from "@/lib/types";
import { useAction } from "@/hooks/use-action";

type Mode = "login" | "register";

interface Props {
  mode: Mode;
  /** Isi kebijakan untuk jendela baca; wajib pada mode daftar. */
  policy?: React.ReactNode;
}

const ROLE_LABEL: Record<Role, string> = {
  student: "Mahasiswa",
  teacher: "Dosen",
};

export function EmailPasswordForm({ mode, policy }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const { pending, error, setError, run, router } = useAction(
    "Gagal memproses. Periksa isian lalu coba lagi.",
  );

  function handleRoleChange(next: Role) {
    setRole(next);
    // Daftar tujuan yang disetujui berbeda per peran, jadi persetujuan diulang.
    setAgreed(false);
    // Pesan "akun ini terdaftar sebagai ..." sudah tidak relevan begitu
    // pengguna mengganti pilihannya.
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Cookie token sudah ditulis sebelum navigasi, jadi render pertama tujuan
    // sudah login — tidak perlu router.refresh() yang me-render dua kali.
    await run(
      () =>
        mode === "login"
          ? login(email, password, role)
          : register({
              email,
              password,
              display_name: displayName.trim(),
              role,
              agreed,
            }),
      (result) => router.replace(homePathForRole(result.profile.role)),
    );
  }

  const submitLabel =
    mode === "login" ? `Masuk sebagai ${ROLE_LABEL[role]}` : `Daftar sebagai ${ROLE_LABEL[role]}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <RoleSelector value={role} onChange={handleRoleChange} />

      {mode === "register" ? (
        <FormField htmlFor="display-name" label="Nama lengkap">
          <IconInput
            id="display-name"
            icon={User}
            suppressHydrationWarning
            type="text"
            required
            maxLength={120}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </FormField>
      ) : null}

      <FormField htmlFor="email" label="Email kampus">
        <IconInput
          id="email"
          icon={Mail}
          // Ignore attributes injected by browser form extensions.
          suppressHydrationWarning
          type="email"
          required
          autoComplete="email"
          placeholder="nama@kampus.ac.id"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Kata sandi</Label>
          {mode === "login" ? (
            <Link
              href="/lupa-sandi"
              className="text-body-sm font-semibold text-brand-ink hover:underline"
            >
              Lupa kata sandi?
            </Link>
          ) : null}
        </div>
        <IconInput
          id="password"
          icon={Lock}
          suppressHydrationWarning
          type={showPassword ? "text" : "password"}
          required
          minLength={mode === "register" ? 10 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          trailing={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              suppressHydrationWarning
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              className="h-8 w-8 text-brand-ink"
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          }
        />
      </div>

      {mode === "register" ? (
        <PolicyConsent role={role} checked={agreed} onChange={setAgreed} policy={policy} />
      ) : null}

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Button
        type="submit"
        suppressHydrationWarning
        disabled={pending || (mode === "register" && !agreed)}
        className="w-full"
        size="lg"
      >
        {pending ? "Memproses..." : submitLabel}
      </Button>
    </form>
  );
}
