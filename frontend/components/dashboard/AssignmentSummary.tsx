import { SubjectTag } from "@/components/common/SubjectTag";
import { Card } from "@/components/ui/card";
import { bloomCode } from "@/lib/bloom";
import { DISPLAY_TIME_ZONE, formatClockHHMM, formatDate } from "@/lib/formatting";
import type { AssignmentSummary as AssignmentSummaryType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  assignment: AssignmentSummaryType;
}

interface MetricProps {
  label: string;
  value: number;
  tone?: "neutral" | "warn" | "high";
}

function Metric({ label, value, tone = "neutral" }: MetricProps) {
  return (
    <div className="text-center">
      <p
        className={cn(
          "text-display-2 font-semibold",
          tone === "high" && "text-danger",
          tone === "warn" && "text-warning",
          tone === "neutral" && "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-body-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function AssignmentSummary({ assignment }: Props) {
  return (
    <Card className="campus-card p-5">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <SubjectTag
            subject={assignment.education_level}
            meta={`Target ${bloomCode(assignment.expected_bloom_level)}`}
          />
          <h2 className="mt-1 text-display-2 font-semibold tracking-tight text-foreground">
            {assignment.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {assignment.deadline ? `Tenggat ${formatDate(assignment.deadline)} · ${formatClockHHMM(assignment.deadline)} (${DISPLAY_TIME_ZONE})` : "Tanpa tenggat"}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-6">
          <Metric label="Terkumpul" value={assignment.submission_count} />
          <Metric
            label="AI tinggi"
            value={assignment.high_band_count}
            tone={assignment.high_band_count > 0 ? "high" : "neutral"}
          />
          <Metric
            label="Perlu diperiksa"
            value={assignment.needs_review_count}
            tone={assignment.needs_review_count > 0 ? "warn" : "neutral"}
          />
        </div>
      </div>
    </Card>
  );
}
