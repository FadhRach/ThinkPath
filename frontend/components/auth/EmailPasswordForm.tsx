"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

interface Props {
  mode: Mode;
}

const SUBMIT_LABEL: Record<Mode, string> = {
  login: "Masuk",
  register: "Daftar",
};

export function EmailPasswordForm({ mode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    if (mode === "register" && !result.data.session) {
      setNotice(
        "Pendaftaran berhasil. Cek email kamu untuk konfirmasi sebelum masuk.",
      );
      setLoading(false);
      return;
    }

    // Setelah sesi tersedia, biarkan dashboard yang memanggil /api/me (server-side).
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="caption-eyebrow">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-card border border-border bg-paper-elevated px-3 py-2.5 text-body focus:outline-none focus:border-accent"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="caption-eyebrow">
          Kata sandi
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-card border border-border bg-paper-elevated px-3 py-2.5 text-body focus:outline-none focus:border-accent"
        />
      </div>
      {error ? (
        <p className="text-body-sm text-signal-high">{error}</p>
      ) : null}
      {notice ? (
        <p className="text-body-sm text-ink-muted">{notice}</p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-card bg-accent px-4 py-2.5 text-paper-elevated text-body hover:opacity-95 transition disabled:opacity-60"
      >
        {loading ? "Memproses..." : SUBMIT_LABEL[mode]}
      </button>
    </form>
  );
}
