import { Compass, ServerCrash, ShieldAlert, WifiOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";

export type StatusKind = "not-found" | "forbidden" | "error" | "offline";

interface Preset {
  code: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: "brand" | "warning" | "danger";
}

const PRESETS: Record<StatusKind, Preset> = {
  "not-found": {
    code: "404",
    title: "Halaman tidak ditemukan",
    description: "Alamat yang kamu buka tidak ada, atau sudah dipindahkan.",
    icon: Compass,
    tone: "brand",
  },
  forbidden: {
    code: "403",
    title: "Kamu tidak punya akses",
    description:
      "Halaman ini hanya bisa dibuka oleh pemiliknya. Coba masuk dengan akun yang sesuai.",
    icon: ShieldAlert,
    tone: "warning",
  },
  error: {
    code: "500",
    title: "Terjadi kesalahan",
    description: "Ada masalah saat memuat halaman. Periksa koneksi internet, lalu coba lagi.",
    icon: ServerCrash,
    tone: "danger",
  },
  offline: {
    code: "Offline",
    title: "Server tidak dapat dihubungi",
    description:
      "ThinkPath sedang bermasalah atau koneksimu terputus. Coba lagi beberapa saat lagi.",
    icon: WifiOff,
    tone: "danger",
  },
};

interface StatusPageProps {
  kind: StatusKind;
  /** Menimpa teks bawaan jenis status ini. */
  title?: string;
  description?: string;
  /** Tombol aksi (mis. kembali ke beranda, coba lagi). */
  actions?: ReactNode;
  /** Sidik galat Next.js; sama dengan yang tercatat di log server. */
  digest?: string;
  /** `screen` memenuhi layar (di luar shell); `inline` dipakai di dalam shell aplikasi. */
  layout?: "screen" | "inline";
}

/**
 * Satu tampilan untuk semua halaman status: 404, 403, galat, dan server mati.
 * Dipakai oleh not-found.tsx dan error.tsx di setiap area, jadi teks dan gayanya
 * seragam dan hanya didefinisikan di sini.
 */
export function StatusPage({
  kind,
  title,
  description,
  actions,
  digest,
  layout = "inline",
}: StatusPageProps) {
  const preset = PRESETS[kind];
  return (
    <div
      className={cn(
        "grid place-items-center px-6",
        layout === "screen" ? "min-h-screen bg-background" : "min-h-[60vh]",
      )}
    >
      <div className="w-full max-w-md space-y-5 text-center">
        <IconTile icon={preset.icon} tone={preset.tone} size="lg" className="mx-auto rounded-2xl" />
        <p className="font-display text-6xl font-medium tracking-tight text-brand-ink">
          {preset.code}
        </p>
        <div className="space-y-2">
          <h1 className="font-display text-title font-medium text-foreground">
            {title ?? preset.title}
          </h1>
          <p className="text-body text-muted-foreground">{description ?? preset.description}</p>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>
        ) : null}
        {digest ? <p className="text-caption text-muted-foreground">Kode galat: {digest}</p> : null}
      </div>
    </div>
  );
}
