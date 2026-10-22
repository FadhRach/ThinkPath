import type { Metadata } from "next";

import { Footer } from "@/components/common/Footer";
import { POLICY_SECTIONS, PolicyArticle } from "@/components/privacy/PolicyArticle";
import { ConsentBanner } from "@/components/privacy/ConsentBanner";
import { PublicHeader } from "@/components/privacy/PublicHeader";
import { PRIVACY_POLICY_EFFECTIVE_LABEL, PRIVACY_POLICY_VERSION } from "@/lib/privacy";

export const metadata: Metadata = {
  title: "Kebijakan Privasi · ThinkPath",
  description:
    "Data apa yang diproses ThinkPath, untuk apa, siapa yang dapat melihatnya, dan hak Anda menurut UU No. 27 Tahun 2022.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-10 sm:px-6">
        <div className="max-w-3xl space-y-3">
          <p className="caption-eyebrow text-primary">Pelindungan data pribadi</p>
          <h1 className="text-display-2 font-extrabold tracking-tight">Kebijakan Privasi ThinkPath</h1>
          <p className="text-body-lg text-muted-foreground">
            Dokumen ini menjelaskan data apa yang diproses ThinkPath, untuk apa, siapa yang
            dapat melihatnya, di mana data disimpan, dan apa hak Anda menurut Undang-Undang
            Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).
          </p>
          <p className="text-body-sm text-muted-foreground">
            Versi {PRIVACY_POLICY_VERSION} · Berlaku sejak {PRIVACY_POLICY_EFFECTIVE_LABEL}
          </p>
          <ConsentBanner />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
          <nav aria-label="Daftar isi" className="lg:sticky lg:top-6">
            <details className="group rounded-xl border border-border bg-card p-4 lg:hidden">
              <summary className="cursor-pointer font-semibold text-foreground">Daftar isi</summary>
              <TocList />
            </details>
            <div className="hidden lg:block">
              <p className="caption-eyebrow mb-2 px-3">Daftar isi</p>
              <TocList />
            </div>
          </nav>

          <PolicyArticle />
        </div>
      </main>

      <Footer />
    </div>
  );
}

function TocList() {
  return (
    <ol className="mt-2 space-y-0.5 text-body-sm">
      {POLICY_SECTIONS.map((section, index) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="flex gap-2 rounded-lg px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <span className="w-5 shrink-0 tabular-nums text-muted-foreground/70">
              {index === 0 ? "" : index}
            </span>
            <span>{section.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}
