"use client";

import { Check, CircleCheck } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONSENT_ITEMS,
  PRIVACY_POLICY_EFFECTIVE_LABEL,
  PRIVACY_POLICY_VERSION,
} from "@/lib/privacy";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  role: Role;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Isi lengkap kebijakan (`PolicyArticle`), dirender server lalu ditampilkan di jendela baca. */
  policy: React.ReactNode;
}

// Selisih piksel yang masih dianggap "sudah di dasar", karena posisi gulir bisa pecahan.
const END_TOLERANCE_PX = 24;

/**
 * Persetujuan satu baris: kotak centang + "Saya setuju dengan Kebijakan Privasi".
 * Kotak itu tidak bisa dicentang langsung. Menekannya membuka jendela baca
 * berisi kebijakan lengkap; tombol "Saya menyetujui" baru aktif setelah pengguna
 * menggulir sampai bawah, lalu jendela menutup dan kotak menjadi hijau.
 * Tiap tujuan ditulis terpisah di awal jendela (Pasal 22 ayat (4) UU No. 27
 * Tahun 2022) dan dicatat server sebagai butir sendiri.
 */
export function PolicyConsent({ role, checked, onChange, policy }: Props) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const you = role === "student" ? "kamu" : "Anda";

  const measure = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    const done = scrollable <= END_TOLERANCE_PX || el.scrollTop >= scrollable - END_TOLERANCE_PX;
    setProgress(scrollable > 0 ? Math.min(100, (el.scrollTop / scrollable) * 100) : 100);
    if (done) setReachedEnd(true);
  }, []);

  function handleBoxClick() {
    if (checked) onChange(false);
    else setOpen(true);
  }

  function handleAgree() {
    onChange(true);
    setOpen(false);
  }

  return (
    <>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label="Setuju dengan Kebijakan Privasi"
          onClick={handleBoxClick}
          className={cn(
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            checked
              ? "border-success bg-success text-white"
              : "border-muted-foreground/50 bg-background hover:border-primary",
          )}
        >
          {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : null}
        </button>
        <p className="text-body-sm text-foreground">
          Saya setuju dengan{" "}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Kebijakan Privasi ThinkPath
          </button>
          {checked ? <span className="ml-1.5 text-success">✓ Disetujui</span> : null}
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[92dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:h-[88dvh]">
          <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12">
            <DialogTitle>Kebijakan Privasi ThinkPath</DialogTitle>
            <DialogDescription>
              Versi {PRIVACY_POLICY_VERSION} · berlaku {PRIVACY_POLICY_EFFECTIVE_LABEL}. Baca
              sampai bagian paling bawah untuk menyetujui.
            </DialogDescription>
          </div>
          <div
            className="h-1 shrink-0 bg-muted"
            role="progressbar"
            aria-label="Progres membaca"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>

          <div
            ref={measure}
            onScroll={(event) => measure(event.currentTarget)}
            className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-5"
          >
            <section className="rounded-2xl border border-brand-mint bg-secondary/40 p-4">
              <p className="font-bold text-foreground">
                Dengan menyetujui, {you} mengizinkan ThinkPath memproses data untuk:
              </p>
              <ul className="mt-2 space-y-1.5">
                {CONSENT_ITEMS[role].map((item) => (
                  <li key={item.key} className="flex gap-2 text-body-sm text-foreground">
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {item.title}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-body-sm text-muted-foreground">
                Tiap tujuan dijelaskan di bagiannya masing-masing di bawah, dan persetujuan ini
                dicatat beserta waktunya sebagai bukti. {you === "kamu" ? "Kamu" : "Anda"} dapat
                menariknya kapan saja di Pengaturan.
              </p>
            </section>

            {policy}
          </div>

          <div className="flex flex-col gap-3 border-t border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body-sm text-muted-foreground">
              {reachedEnd
                ? "Sudah dibaca sampai akhir."
                : "Gulir sampai akhir untuk mengaktifkan tombol setuju."}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
                Tutup
              </Button>
              <Button onClick={handleAgree} disabled={!reachedEnd} className="flex-1 sm:flex-none">
                Saya menyetujui
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
