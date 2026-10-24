"use client";

import { CircleCheck, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatClockHHMM, formatDate } from "@/lib/formatting";
import { withdrawConsent } from "@/lib/mutations";
import { CONSENT_ITEMS, PRIVACY_CONTACT_EMAIL } from "@/lib/privacy";
import type { ConsentActionKind, ConsentStatus, Role } from "@/lib/types";
import { useAction } from "@/hooks/use-action";

const ACTION_LABEL: Record<ConsentActionKind, string> = {
  given: "Persetujuan diberikan",
  updated: "Pilihan diperbarui",
  withdrawn: "Persetujuan ditarik",
};

const SOURCE_LABEL: Record<string, string> = {
  register: "saat mendaftar",
  reaccept: "persetujuan ulang",
  withdraw: "dari Pengaturan",
  seed: "akun demo",
};

function when(iso: string): string {
  return `${formatDate(iso)} pukul ${formatClockHHMM(iso)}`;
}

/** Nomor bukti: delapan karakter pertama id catatan, cukup untuk dirujuk dalam permohonan. */
function proofNumber(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/**
 * Kebijakan dan persetujuan di Pengaturan: bukti persetujuan yang berlaku
 * (versi, waktu, tujuan, nomor), rekam jejaknya (Pasal 24 dan 32 UU PDP), tautan
 * ke kebijakan lengkap, dan penarikan persetujuan (Pasal 9). Persetujuannya
 * sendiri diberikan satu kali di form daftar.
 */
export function ConsentProof({ role, consent }: { role: Role; consent: ConsentStatus }) {
  const [open, setOpen] = useState(false);
  const withdraw = useAction("Persetujuan gagal ditarik. Coba lagi.");
  const isStudent = role === "student";
  // Bukti hanya ditampilkan selagi persetujuan berlaku; setelah ditarik, baris lama bukan bukti lagi.
  const proof =
    consent.status === "given"
      ? consent.history.find(
          (entry) => entry.action === "given" && entry.policy_version === consent.current_version,
        )
      : undefined;

  async function handleWithdraw() {
    await withdraw.run(
      () => withdrawConsent(),
      () => {
        setOpen(false);
        withdraw.router.replace("/persetujuan");
        withdraw.router.refresh();
      },
    );
  }

  return (
    <Card variant="raised" className="space-y-5 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-brand-ink">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-foreground">Kebijakan dan persetujuan</h2>
          <p className="text-body-sm text-muted-foreground">
            {consent.given_at
              ? `Disetujui ${when(consent.given_at)} untuk Kebijakan Privasi versi ${consent.current_version}.`
              : "Belum ada persetujuan yang berlaku."}
          </p>
          <Link
            href="/kebijakan-privasi"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-body-sm font-semibold text-brand-ink hover:underline"
          >
            Baca Kebijakan Privasi
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {proof ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-body-sm font-semibold text-foreground">
            Bukti persetujuan yang berlaku
          </p>
          <dl className="space-y-1.5 text-body-sm">
            <ProofRow label="Nomor bukti" value={proofNumber(proof.id)} mono />
            <ProofRow label="Versi kebijakan" value={proof.policy_version} />
            <ProofRow label="Waktu" value={when(proof.created_at)} />
            {proof.source ? (
              <ProofRow label="Diberikan" value={SOURCE_LABEL[proof.source] ?? proof.source} />
            ) : null}
          </dl>
          <ul className="space-y-1">
            {CONSENT_ITEMS[role]
              .filter((item) => proof.items.includes(item.key))
              .map((item) => (
                <li key={item.key} className="flex gap-2 text-body-sm text-foreground">
                  <CircleCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink"
                    aria-hidden="true"
                  />
                  {item.title}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-body-sm font-semibold text-foreground">Riwayat persetujuan</p>
        <ol className="space-y-2 border-l-2 border-border pl-4">
          {consent.history.map((entry) => (
            <li key={entry.id} className="text-body-sm">
              <p className="font-medium text-foreground">{ACTION_LABEL[entry.action]}</p>
              <p className="text-caption text-muted-foreground">
                {when(entry.created_at)} · versi {entry.policy_version} · no.{" "}
                {proofNumber(entry.id)}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-2 border-t border-border pt-4 text-body-sm text-muted-foreground">
        <p>
          Untuk meminta salinan data, perbaikan, atau penghapusan,{" "}
          {PRIVACY_CONTACT_EMAIL ? (
            <>
              kirim email ke{" "}
              <a
                href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                className="font-medium text-brand-ink hover:underline"
              >
                {PRIVACY_CONTACT_EMAIL}
              </a>
              .
            </>
          ) : (
            <>
              sampaikan permohonan tertulis kepada dosen pengampu kelas{" "}
              {isStudent ? "kamu" : "Anda"}.
            </>
          )}{" "}
          Permohonan akses dan perbaikan ditanggapi paling lambat 3 × 24 jam.
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full border-danger/40 text-danger hover:bg-danger-soft hover:text-danger"
          >
            Tarik persetujuan
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tarik persetujuan?</DialogTitle>
            <DialogDescription>
              {isStudent
                ? "Pemrosesan baru berhenti seketika: kamu tidak bisa memakai ThinkPath, mengumpulkan jawaban, atau mengerjakan Cek Paham sampai kamu menyetujui kembali. Data yang sudah ada tidak otomatis terhapus; untuk menghapusnya, ajukan permohonan penghapusan."
                : "Anda tidak dapat memakai ThinkPath sampai menyetujui kembali. Data yang sudah ada tidak otomatis terhapus; untuk menghapusnya, ajukan permohonan penghapusan."}
            </DialogDescription>
          </DialogHeader>
          {withdraw.error ? <p className="text-body-sm text-danger">{withdraw.error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={withdraw.pending}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleWithdraw} disabled={withdraw.pending}>
              {withdraw.pending ? "Menarik..." : "Tarik persetujuan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ProofRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-foreground" : "text-right text-foreground"}>{value}</dd>
    </div>
  );
}
