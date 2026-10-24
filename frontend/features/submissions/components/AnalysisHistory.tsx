import { aiBandLabel } from "@/features/submissions/lib/status";
import { formatDate, formatClockHHMM } from "@/lib/formatting";
import type { AnalysisRunView, AnalysisSource } from "@/lib/types";

const TRIGGER_LABEL: Record<AnalysisRunView["trigger"], string> = {
  submit: "Saat dikumpulkan",
  revise: "Setelah revisi",
  reanalyze: "Analisis ulang",
};

const SOURCE_LABEL: Record<AnalysisSource, string> = {
  llm: "analisis penuh",
  detector: "detektor eksternal",
  heuristic: "cadangan",
  seed: "data demo",
};

/** Setiap analisis tersimpan permanen, jadi skor yang pernah dilihat tidak hilang diam-diam. */
export function AnalysisHistory({ runs }: { runs: AnalysisRunView[] }) {
  if (runs.length === 0) {
    return <p className="text-body-sm text-muted-foreground">Belum ada analisis yang tersimpan.</p>;
  }
  return (
    <ul className="divide-y divide-border text-body-sm">
      {runs.map((run, index) => (
        <li
          key={run.id}
          className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0"
        >
          <span className="font-medium text-foreground">
            {TRIGGER_LABEL[run.trigger]}
            {index === 0 ? (
              <span className="ml-2 text-caption font-normal text-muted-foreground">terkini</span>
            ) : null}
          </span>
          <span className="text-muted-foreground">
            Skor {run.ai_score} ({aiBandLabel(run.ai_band)}), {SOURCE_LABEL[run.analysis_source]},{" "}
            {formatDate(run.created_at)} {formatClockHHMM(run.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
