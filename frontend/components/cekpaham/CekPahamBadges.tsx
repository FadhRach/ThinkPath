import { ATTEMPT_STATUS_LABEL, BAND_LABEL, PHASE_LABEL } from "@/lib/cekpaham";
import type { CekPahamAttemptStatus, CekPahamBand, CekPahamPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHIP = "inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium";

const PHASE_TONE: Record<CekPahamPhase, string> = {
  upcoming: "bg-muted text-foreground",
  open: "bg-secondary text-primary",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_TONE: Record<CekPahamAttemptStatus, string> = {
  in_progress: "bg-secondary text-primary",
  processing: "bg-secondary text-primary",
  scored: "bg-success-soft text-success",
  processing_failed: "bg-warning-soft text-warning",
  interrupted: "bg-warning-soft text-warning",
  voided: "bg-muted text-muted-foreground",
};

const BAND_TONE: Record<Exclude<CekPahamBand, "">, string> = {
  kuat: "bg-success-soft text-success",
  sebagian: "bg-secondary text-primary",
  lemah: "bg-warning-soft text-warning",
};

export function PhaseBadge({ phase }: { phase: CekPahamPhase }) {
  return <span className={cn(CHIP, PHASE_TONE[phase])}>{PHASE_LABEL[phase]}</span>;
}

export function AttemptStatusBadge({ status }: { status: CekPahamAttemptStatus }) {
  return <span className={cn(CHIP, STATUS_TONE[status])}>{ATTEMPT_STATUS_LABEL[status]}</span>;
}

export function BandBadge({ band }: { band: CekPahamBand }) {
  if (band === "") return null;
  return <span className={cn(CHIP, BAND_TONE[band])}>{BAND_LABEL[band]}</span>;
}
