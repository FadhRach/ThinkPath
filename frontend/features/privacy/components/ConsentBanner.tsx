import { BadgeCheck } from "lucide-react";
import Link from "next/link";

import { readAuthClaims } from "@/lib/auth-claims";
import { getConsent } from "@/lib/data";
import { formatClockHHMM, formatDate } from "@/lib/formatting";
import type { ConsentStatus } from "@/lib/types";

async function loadConsent(): Promise<ConsentStatus | null> {
  try {
    return await getConsent();
  } catch {
    // Halaman kebijakan harus tetap terbaca walau backend sedang tidak terjangkau.
    return null;
  }
}

/**
 * Pita di atas halaman kebijakan untuk pembaca yang sudah masuk: versi dan
 * waktu persetujuan miliknya, atau ajakan menyetujui bila belum berlaku.
 * Pengunjung publik tidak melihat apa pun.
 */
export async function ConsentBanner() {
  if (!(await readAuthClaims())) return null;
  const consent = await loadConsent();
  if (!consent) return null;

  if (consent.status === "given" && consent.given_at) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-brand-mint bg-secondary/40 px-4 py-3 text-body-sm text-foreground">
        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
        <p>
          Anda menyetujui Kebijakan Privasi versi {consent.current_version} pada{" "}
          {formatDate(consent.given_at)} pukul {formatClockHHMM(consent.given_at)}. Buktinya ada di
          Pengaturan.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm text-foreground">
      Persetujuan Anda untuk versi {consent.current_version} belum berlaku.{" "}
      <Link href="/persetujuan" className="font-semibold text-brand-ink hover:underline">
        Setujui sekarang
      </Link>
      .
    </div>
  );
}
