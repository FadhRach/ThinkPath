import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ATTEMPT_STATUS_LABEL, BAND_LABEL, PHASE_LABEL } from "@/features/cekpaham/lib/labels";
import type { CekPahamAttemptStatus, CekPahamBand, CekPahamPhase } from "@/lib/types";

const PHASE_TONE: Record<CekPahamPhase, BadgeTone> = {
  upcoming: "neutral",
  open: "brand",
  closed: "neutral",
  cancelled: "neutral",
};

const STATUS_TONE: Record<CekPahamAttemptStatus, BadgeTone> = {
  in_progress: "brand",
  processing: "brand",
  scored: "success",
  processing_failed: "warning",
  interrupted: "warning",
  voided: "neutral",
};

const BAND_TONE: Record<Exclude<CekPahamBand, "">, BadgeTone> = {
  kuat: "success",
  sebagian: "brand",
  lemah: "warning",
};

export function PhaseBadge({ phase }: { phase: CekPahamPhase }) {
  return <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>;
}

export function AttemptStatusBadge({ status }: { status: CekPahamAttemptStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{ATTEMPT_STATUS_LABEL[status]}</Badge>;
}

export function BandBadge({ band }: { band: CekPahamBand }) {
  if (band === "") return null;
  return <Badge tone={BAND_TONE[band]}>{BAND_LABEL[band]}</Badge>;
}
