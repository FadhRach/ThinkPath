import type { AssignmentSummary as AssignmentSummaryType } from "@/lib/types";

interface Props {
  assignment: AssignmentSummaryType;
}

interface MetricProps {
  label: string;
  value: number;
  tone?: "neutral" | "warn" | "high";
}

function Metric({ label, value, tone = "neutral" }: MetricProps) {
  const toneClass =
    tone === "high"
      ? "text-signal-high"
      : tone === "warn"
      ? "text-signal-mid"
      : "text-ink";
  return (
    <div>
      <p className="caption-eyebrow">{label}</p>
      <p className={`font-display text-display-2 ${toneClass}`}>{value}</p>
    </div>
  );
}

export function AssignmentSummary({ assignment }: Props) {
  return (
    <section className="bg-paper-elevated border border-border rounded-card p-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="caption-eyebrow">{assignment.education_level} · Bloom L{assignment.expected_bloom_level}</p>
          <h2 className="font-display text-display-2 mt-1">{assignment.title}</h2>
          {assignment.instructions ? (
            <p className="text-body text-ink-muted mt-2 max-w-2xl">
              {assignment.instructions}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-6 shrink-0">
          <Metric label="Dianalisis" value={assignment.submission_count} />
          <Metric
            label="Perlu ditinjau"
            value={assignment.high_band_count}
            tone={assignment.high_band_count > 0 ? "high" : "neutral"}
          />
          <Metric
            label="Belum direview"
            value={assignment.needs_review_count}
            tone={assignment.needs_review_count > 0 ? "warn" : "neutral"}
          />
        </div>
      </div>
    </section>
  );
}
