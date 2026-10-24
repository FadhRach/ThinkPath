"use client";

import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

import { PolicyConsent } from "@/features/privacy/components/PolicyConsent";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/mutations";
import { giveConsent } from "@/lib/mutations";
import { PRIVACY_POLICY_EFFECTIVE_LABEL } from "@/lib/privacy";
import type { ConsentState, Role } from "@/lib/types";
import { useAction } from "@/hooks/use-action";

interface Props {
  role: Role;
  previous: ConsentState;
  home: string;
  /** Isi kebijakan untuk jendela baca. */
  policy: React.ReactNode;
}

/**
 * Persetujuan ulang sebelum memakai ThinkPath: untuk akun yang belum pernah
 * menyetujui versi yang berlaku, kebijakan yang berubah, atau persetujuan yang
 * ditarik. Akun baru menyetujui di form daftar dan tidak pernah sampai ke sini.
 */
export function ConsentScreen({ role, previous, home, policy }: Props) {
  const [checked, setChecked] = useState(false);
  const { pending, error, run, router } = useAction(
    "Persetujuan gagal disimpan. Coba lagi sebentar lagi.",
  );
  const isStudent = role === "student";

  async function handleAgree() {
    await run(giveConsent, () => {
      router.replace(home);
      router.refresh();
    });
  }

  async function handleDecline() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="caption-eyebrow text-brand-ink">Persetujuan pemrosesan data pribadi</p>
        <h1 className="text-display-2 font-extrabold tracking-tight text-foreground">
          {previous === "outdated"
            ? "Kebijakan Privasi diperbarui"
            : "Setujui Kebijakan Privasi untuk melanjutkan"}
        </h1>
        {previous === "outdated" ? (
          <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm text-foreground">
            Kebijakan Privasi diperbarui pada {PRIVACY_POLICY_EFFECTIVE_LABEL}.{" "}
            <a
              href="/kebijakan-privasi#perubahan"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-ink hover:underline"
            >
              {isStudent ? "Baca perubahannya" : "Mohon baca perubahannya"}
            </a>{" "}
            dan setujui kembali untuk melanjutkan.
          </p>
        ) : previous === "withdrawn" ? (
          <p className="rounded-xl border border-border bg-muted px-4 py-3 text-body-sm text-foreground">
            {isStudent ? "Kamu telah menarik persetujuan." : "Anda telah menarik persetujuan."}{" "}
            Untuk memakai ThinkPath lagi, setujui kembali di bawah.
          </p>
        ) : (
          <p className="text-body-lg text-muted-foreground">
            {isStudent ? "Baca kebijakannya, " : "Mohon baca kebijakannya, "}
            lalu setujui untuk memakai ThinkPath.
          </p>
        )}
      </div>

      <PolicyConsent role={role} checked={checked} onChange={setChecked} policy={policy} />

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Button variant="ghost" onClick={handleDecline} disabled={pending}>
          Tidak setuju, keluar
        </Button>
        <Button onClick={handleAgree} disabled={!checked || pending} className="sm:ml-auto">
          {pending ? "Menyimpan..." : "Setuju dan lanjutkan"}
        </Button>
      </div>

      <p className="border-t border-border pt-4 text-body-sm text-muted-foreground">
        {isStudent
          ? "Tidak ingin memakai ThinkPath? Bicarakan dengan dosenmu untuk cara pengumpulan tugas yang lain. "
          : null}
        <a
          href="/kebijakan-privasi"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline"
        >
          Buka Kebijakan Privasi lengkap
          <ExternalLinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}
