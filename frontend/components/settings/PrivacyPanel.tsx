"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { formatClockHHMM, formatDate } from "@/lib/formatting";
import { setExternalAnalysis, withdrawConsent } from "@/lib/mutations";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/privacy";
import type { ConsentActionKind, ConsentStatus, Role } from "@/lib/types";
import { useAction } from "@/lib/use-action";

const ACTION_LABEL: Record<ConsentActionKind, string> = {
  given: "Persetujuan diberikan",
  updated: "Pilihan opsional diubah",
  withdrawn: "Persetujuan ditarik",
};

function when(iso: string): string {
  return `${formatDate(iso)} pukul ${formatClockHHMM(iso)}`;
}

/**
 * Bagian Privasi di Pengaturan: keadaan persetujuan, pilihan opsional,
 * rekam jejaknya (Pasal 32 UU PDP), dan penarikan persetujuan (Pasal 9).
 */
export function PrivacyPanel({ role, consent }: { role: Role; consent: ConsentStatus }) {
  const [status, setStatus] = useState(consent);
  const [open, setOpen] = useState(false);
  const toggle = useAction("Pilihan gagal disimpan. Coba lagi.");
  const withdraw = useAction("Persetujuan gagal ditarik. Coba lagi.");
  const isStudent = role === "student";

  async function handleExternal(allowed: boolean) {
    await toggle.run(
      () => setExternalAnalysis(allowed),
      (next) => setStatus(next),
    );
  }

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
    <Card className="space-y-5 p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-foreground">Privasi dan persetujuan</h2>
          <p className="text-body-sm text-muted-foreground">
            {status.given_at
              ? `Disetujui ${when(status.given_at)} untuk Kebijakan Privasi versi ${status.current_version}.`
              : "Belum ada persetujuan yang berlaku."}
          </p>
          <Link
            href="/kebijakan-privasi"
            target="_blank"
            className="mt-1 inline-flex items-center gap-1 text-body-sm font-semibold text-primary hover:underline"
          >
            Baca Kebijakan Privasi
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {isStudent ? (
        <div className="space-y-2 rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-4">
            <label htmlFor="external-ai" className="font-semibold text-foreground">
              Analisis tambahan oleh penyedia di luar negeri
            </label>
            <Switch
              id="external-ai"
              checked={status.external_ai}
              onCheckedChange={handleExternal}
              disabled={toggle.pending}
            />
          </div>
          <p className="text-body-sm text-muted-foreground">
            {status.external_ai
              ? "Aktif: teks jawabanmu yang berikutnya boleh dianalisis Groq (Amerika Serikat) dan Winston AI (Kanada), tanpa nama atau email."
              : "Nonaktif: jawabanmu yang berikutnya hanya dianalisis heuristik di server ThinkPath. Hasilnya bisa kurang akurat, dan dosen melihat bahwa skornya berasal dari heuristik."}
          </p>
          {toggle.error ? <p className="text-body-sm text-danger">{toggle.error}</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-body-sm font-semibold text-foreground">Riwayat persetujuan</p>
        <ol className="space-y-2 border-l-2 border-border pl-4">
          {status.history.map((entry) => (
            <li key={`${entry.action}-${entry.created_at}`} className="text-body-sm">
              <p className="font-medium text-foreground">{ACTION_LABEL[entry.action]}</p>
              <p className="text-caption text-muted-foreground">
                {when(entry.created_at)} · versi {entry.policy_version}
                {entry.items.includes("analisis_luar_negeri")
                  ? " · termasuk analisis di luar negeri"
                  : ""}
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
                className="font-medium text-primary hover:underline"
              >
                {PRIVACY_CONTACT_EMAIL}
              </a>
              .
            </>
          ) : (
            <>sampaikan permohonan tertulis kepada dosen pengampu kelas {isStudent ? "kamu" : "Anda"}.</>
          )}{" "}
          Permohonan akses dan perbaikan ditanggapi paling lambat 3 × 24 jam.
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full border-danger/40 text-danger hover:bg-danger-soft hover:text-danger">
            Tarik persetujuan
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tarik persetujuan?</DialogTitle>
            <DialogDescription>
              {isStudent
                ? "Pemrosesan baru berhenti seketika: kamu tidak bisa mengumpulkan jawaban dan dosen tidak bisa menganalisis ulang jawabanmu sampai kamu menyetujui kembali. Data yang sudah ada tidak otomatis terhapus; untuk menghapusnya, ajukan permohonan penghapusan."
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
