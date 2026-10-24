import type { BadgeTone } from "@/components/ui/badge";
import type { AiBand, SubmissionStatus } from "@/lib/types";

export function aiBandTone(band: AiBand): BadgeTone {
  if (band === "high") return "danger";
  if (band === "mid") return "warning";
  return "success";
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
  tone: BadgeTone;
}

const STATUS_META: Record<SubmissionStatus, StatusMeta> = {
  draft: { label: "Sedang dikerjakan", tone: "brand" },
  submitted: { label: "Perlu diperiksa", tone: "warning" },
  reviewed: { label: "Sudah dinilai", tone: "success" },
};

export function submissionStatusMeta(status: SubmissionStatus): StatusMeta {
  return STATUS_META[status];
}
