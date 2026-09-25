import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Brandmark } from "@/components/common/Brandmark";
import { ConsentScreen } from "@/components/privacy/ConsentScreen";
import { readAuthClaims } from "@/lib/auth-claims";
import { getConsent } from "@/lib/data";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";

export const metadata: Metadata = {
  title: "Persetujuan Data Pribadi · ThinkPath",
};

// Keputusannya bergantung pada cookie per permintaan.
export const dynamic = "force-dynamic";

/**
 * Gerbang sebelum aplikasi. Layout dosen dan mahasiswa mengarahkan ke sini
 * selama token belum memuat persetujuan untuk versi kebijakan yang berlaku.
 */
export default async function ConsentPage() {
  const claims = readAuthClaims();
  if (!claims) redirect("/login");
  const home = claims.role === "teacher" ? "/dashboard" : "/student";
  if (claims.consent === PRIVACY_POLICY_VERSION) redirect(home);

  const status = await getConsent();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Brandmark />
          <Link
            href="/kebijakan-privasi"
            target="_blank"
            className="text-body-sm font-semibold text-primary hover:underline"
          >
            Kebijakan Privasi
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <ConsentScreen role={claims.role} previous={status.status} home={home} />
      </main>
    </div>
  );
}
