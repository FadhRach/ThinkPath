"use client";

import {
  CircleCheck,
  CircleSlash,
  ExternalLink as ExternalLinkIcon,
  Eye,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { giveConsent } from "@/lib/mutations";
import {
  CONSENT_ITEMS,
  PRIVACY_POLICY_EFFECTIVE_LABEL,
  PRIVACY_POLICY_VERSION,
  type ConsentItemKey,
} from "@/lib/privacy";
import type { ConsentState, Role } from "@/lib/types";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

interface Summary {
  icon: LucideIcon;
  title: string;
  points: string[];
}

const SUMMARY: Record<Role, Summary[]> = {
  student: [
    {
      icon: CircleCheck,
      title: "Yang dicatat",
      points: [
        "Jumlah kata setiap 30 detik selama form jawaban terbuka",
        "Waktu mulai, waktu kumpul, dan jumlah revisi",
        "Jawaban, nilai, dan umpan balik dosen",
      ],
    },
    {
      icon: CircleSlash,
      title: "Yang tidak dicatat",
      points: [
        "Isi ketikan per detik dan tindakan menempel",
        "Layar, kamera, mikrofon, dan lokasi",
        "Cookie iklan atau pelacak",
      ],
    },
    {
      icon: Eye,
      title: "Siapa yang melihat",
      points: [
        "Dosen pengampu kelasmu, hanya untuk kelasnya sendiri",
        "Skor indikasi AI tidak tampil di layarmu, tetapi salinannya boleh kamu minta",
      ],
    },
    {
      icon: Scale,
      title: "Hakmu",
      points: [
        "Mengakses, memperbaiki, dan meminta data dihapus",
        "Menarik persetujuan kapan saja di Pengaturan",
        "Mengajukan keberatan atas hasil analisis",
      ],
    },
  ],
  teacher: [
    {
      icon: Eye,
      title: "Yang Anda lihat",
      points: [
        "Jawaban, jejak proses, dan hasil analisis mahasiswa di kelas Anda",
        "Tidak ada data dari kelas dosen lain",
      ],
    },
    {
      icon: ShieldCheck,
      title: "Batas hasil analisis",
      points: [
        "Skor indikasi AI dan level Bloom adalah bahan tinjau, bukan vonis",
        "Ketepatannya pada esai mahasiswa belum diukur; rinciannya ada di Kebijakan Privasi",
      ],
    },
    {
      icon: Scale,
      title: "Hak mahasiswa",
      points: [
        "Mahasiswa dapat mengajukan keberatan dan meminta ditinjau ulang",
        "Mahasiswa dapat meminta akses, perbaikan, dan penghapusan data",
      ],
    },
  ],
};

interface Props {
  role: Role;
  previous: ConsentState;
  home: string;
}

/**
 * Layar persetujuan sebelum memakai ThinkPath.
 *
 * Butir wajib dan opsional dicentang satu per satu, tidak ada yang tercentang
 * dari awal, karena persetujuan harus berupa tindakan yang disengaja dan tiap
 * tujuan harus dapat dibedakan (Pasal 22 ayat (4) UU PDP).
 */
export function ConsentScreen({ role, previous, home }: Props) {
  const items = CONSENT_ITEMS[role];
  const [checked, setChecked] = useState<Partial<Record<ConsentItemKey, boolean>>>({});
  const { pending, error, run, router } = useAction(
    "Persetujuan gagal disimpan. Coba lagi sebentar lagi.",
  );
  const isStudent = role === "student";
  const ready = items.filter((item) => item.required).every((item) => checked[item.key]);

  async function handleAgree() {
    const agreed = items.filter((item) => checked[item.key]).map((item) => item.key);
    await run(
      () => giveConsent(agreed),
      () => {
        router.replace(home);
        router.refresh();
      },
    );
  }

  function handleDecline() {
    logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="caption-eyebrow text-primary">Persetujuan pemrosesan data pribadi</p>
        <h1 className="text-display-2 font-extrabold tracking-tight text-foreground">
          {isStudent
            ? "Sebelum mulai, pahami dulu cara ThinkPath memakai datamu"
            : "Sebelum mulai, mohon baca cara ThinkPath memakai data"}
        </h1>
        {previous === "outdated" ? (
          <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-body-sm text-foreground">
            Kebijakan Privasi diperbarui pada {PRIVACY_POLICY_EFFECTIVE_LABEL}.{" "}
            {isStudent ? "Baca perubahannya dan setujui kembali" : "Mohon baca perubahannya dan setujui kembali"}{" "}
            untuk melanjutkan.
          </p>
        ) : previous === "withdrawn" ? (
          <p className="rounded-xl border border-border bg-muted px-4 py-3 text-body-sm text-foreground">
            {isStudent
              ? "Kamu telah menarik persetujuan. Untuk memakai ThinkPath lagi, setujui kembali di bawah."
              : "Anda telah menarik persetujuan. Untuk memakai ThinkPath lagi, setujui kembali di bawah."}
          </p>
        ) : (
          <p className="text-body-lg text-muted-foreground">
            {isStudent
              ? "Ringkasnya ada di bawah. Versi lengkapnya ada di Kebijakan Privasi, dan kamu bisa membacanya kapan saja."
              : "Ringkasnya ada di bawah. Versi lengkapnya ada di Kebijakan Privasi dan dapat dibaca kapan saja."}
          </p>
        )}
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2",
          SUMMARY[role].length === 3 && "lg:grid-cols-3",
        )}
      >
        {SUMMARY[role].map((card) => (
          <div key={card.title} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-primary">
                <card.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="font-bold text-foreground">{card.title}</p>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-body-sm text-muted-foreground marker:text-primary">
              {card.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-3 text-lg font-bold text-foreground">
          {isStudent ? "Centang yang kamu setujui" : "Centang yang Anda setujui"}
        </legend>
        {items.map((item) => (
          <label
            key={item.key}
            className={cn(
              "flex cursor-pointer gap-3 rounded-2xl border bg-card p-4 shadow-soft transition",
              checked[item.key] ? "border-primary/60 bg-secondary/20" : "border-border hover:border-primary/40",
            )}
          >
            <input
              type="checkbox"
              checked={Boolean(checked[item.key])}
              onChange={(event) =>
                setChecked((current) => ({ ...current, [item.key]: event.target.checked }))
              }
              className="mt-1 h-5 w-5 shrink-0 accent-primary"
            />
            <span className="min-w-0 space-y-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{item.title}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-caption font-semibold",
                    item.required
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {item.required ? "Wajib" : "Opsional"}
                </span>
              </span>
              <span className="block text-body-sm text-muted-foreground">{item.body}</span>
              <a
                href={`/kebijakan-privasi#${item.anchor}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline"
              >
                Baca selengkapnya
                <ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
              </a>
            </span>
          </label>
        ))}
      </fieldset>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Button variant="ghost" onClick={handleDecline} disabled={pending}>
          Tidak setuju, keluar
        </Button>
        <Button onClick={handleAgree} disabled={!ready || pending} className="sm:ml-auto">
          {pending ? "Menyimpan..." : "Setuju dan lanjutkan"}
        </Button>
      </div>

      <div className="space-y-2 border-t border-border pt-5 text-body-sm text-muted-foreground">
        <p>
          Persetujuan ini dicatat beserta waktunya dan versi kebijakan {PRIVACY_POLICY_VERSION}{" "}
          sebagai bukti (Pasal 22 dan 24 UU No. 27 Tahun 2022).{" "}
          {isStudent
            ? "Pilihan opsional bisa kamu ubah, dan persetujuan bisa kamu tarik, kapan saja di Pengaturan."
            : "Persetujuan dapat Anda tarik kapan saja di Pengaturan."}
        </p>
        {isStudent ? (
          <p>
            Tidak ingin memakai ThinkPath? Bicarakan dengan dosenmu untuk cara pengumpulan tugas
            yang lain.
          </p>
        ) : null}
        <p>
          <a
            href="/kebijakan-privasi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Buka Kebijakan Privasi lengkap
            <ExternalLinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </p>
      </div>
    </div>
  );
}
