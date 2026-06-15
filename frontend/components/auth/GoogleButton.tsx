"use client";

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function GoogleButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full border border-border rounded-card px-4 py-2.5 text-body hover:bg-accent-soft transition disabled:opacity-60"
      >
        {loading ? "Mengarahkan ke Google..." : "Lanjut dengan Google"}
      </button>
      {error ? (
        <p className="text-body-sm text-signal-high">{error}</p>
      ) : null}
    </div>
  );
}
