import { SubjectTag } from "@/components/common/SubjectTag";
import { Card } from "@/components/ui/card";
import { bloomCode } from "@/lib/bloom";
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
          "text-display-2 font-extrabold",
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
    <Card className="p-6 shadow-soft">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <SubjectTag
            subject={assignment.education_level}
            meta={`Target ${bloomCode(assignment.expected_bloom_level)}`}
          />
          <h2 className="mt-1 text-display-2 font-extrabold tracking-tight text-foreground">
            {assignment.title}
          </h2>
          {assignment.instructions ? (
            <p className="mt-2 max-w-2xl text-body text-muted-foreground">
              {assignment.instructions}
            </p>
          ) : null}
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-6">
          <Metric label="Dianalisis" value={assignment.submission_count} />
          <Metric
            label="Indikasi AI"
            value={assignment.high_band_count}
            tone={assignment.high_band_count > 0 ? "high" : "neutral"}
          />
          <Metric
            label="Perlu review"
            value={assignment.needs_review_count}
            tone={assignment.needs_review_count > 0 ? "warn" : "neutral"}
          />
        </div>
      </div>
    </Card>
  );
}
