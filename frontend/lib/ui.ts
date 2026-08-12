import type { AiBand, SubmissionStatus } from "@/lib/types";

// Kelas warna badge dikelompokkan di sini agar konsisten di seluruh aplikasi.
type BadgeStyle = string;

const BADGE: Record<string, BadgeStyle> = {
  teal: "bg-secondary text-secondary-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  muted: "bg-muted text-muted-foreground",
};

export function aiBandBadgeClass(band: AiBand): BadgeStyle {
  if (band === "high") return BADGE.danger;
  if (band === "mid") return BADGE.warning;
  return BADGE.success;
}

export function aiBandBarClass(band: AiBand): string {
  if (band === "high") return "bg-danger";
  if (band === "mid") return "bg-warning";
  return "bg-success";
}

export function aiBandLabel(band: AiBand): string {
  if (band === "high") return "Indikasi AI tinggi";
  if (band === "mid") return "Indikasi AI sedang";
  return "Indikasi AI rendah";
}

interface StatusMeta {
  label: string;
  badgeClass: BadgeStyle;
}

const STATUS_META: Record<SubmissionStatus, StatusMeta> = {
  draft: { label: "Sedang dikerjakan", badgeClass: BADGE.teal },
  submitted: { label: "Perlu review", badgeClass: BADGE.warning },
  reviewed: { label: "Selesai", badgeClass: BADGE.success },
};

export function submissionStatusMeta(status: SubmissionStatus): StatusMeta {
  return STATUS_META[status];
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

// Avatar diberi warna deterministik dari nama agar stabil antar render.
const AVATAR_PALETTE = [
  "bg-brand-pink text-danger",
  "bg-secondary text-secondary-foreground",
  "bg-accent text-accent-foreground",
  "bg-warning-soft text-warning",
];

export function avatarColorClass(name: string | null | undefined): string {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  }
  return AVATAR_PALETTE[hash];
}

// Warna seri chart mengambil token brand agar seragam dengan badge.
export const CHART_COLORS = {
  primary: "hsl(var(--brand-teal))",
  primarySoft: "hsl(var(--brand-teal) / 0.12)",
  light: "hsl(var(--brand-teal-light))",
  mint: "hsl(var(--brand-mint))",
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
};
