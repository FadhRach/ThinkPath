import { formatClockHHMM, formatDurationSeconds } from "@/lib/formatting";
import type { ReasoningEventView, SubmissionDetail } from "@/lib/types";

interface Props {
  detail: SubmissionDetail;
}

function findPasteEvent(events: ReasoningEventView[]): ReasoningEventView | undefined {
  return events.find((event) => event.event_type === "paste");
}

function pasteCharCount(event: ReasoningEventView): number | null {
  const value = event.payload?.char_count;
  return typeof value === "number" ? value : null;
}

export function ReasoningSummary({ detail }: Props) {
  const pasteEvent = findPasteEvent(detail.reasoning_events);
  const pasteCount = pasteEvent ? pasteCharCount(pasteEvent) : null;

  const sentenceParts: string[] = [
    `mulai ${formatClockHHMM(detail.started_at)}`,
    `${detail.revision_count} revisi`,
  ];
  if (pasteEvent && pasteCount !== null) {
    sentenceParts.push(`1 paste besar (${pasteCount} karakter)`);
  } else {
    sentenceParts.push("tanpa paste besar");
  }
  if (detail.submitted_at) {
    sentenceParts.push(
      `submit ${formatClockHHMM(detail.submitted_at)} (durasi ${formatDurationSeconds(detail.duration_seconds)})`,
    );
  }

  return (
    <p className="text-body-sm leading-relaxed text-foreground">
      {sentenceParts.join(", ")}.
    </p>
  );
}
