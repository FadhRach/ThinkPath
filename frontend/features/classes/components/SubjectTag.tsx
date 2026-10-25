import { cn } from "@/lib/utils";

interface Props {
  subject: string;
  meta?: string;
  className?: string;
}

// Eyebrow mata pelajaran, mis. "SEJARAH  Esai  60 menit".
export function SubjectTag({ subject, meta, className }: Props) {
  return (
    <p className={cn("caption-eyebrow text-brand-ink", className)}>
      {subject}
      {meta ? (
        <span className="text-muted-foreground">
          {" "}
          {"·"} {meta}
        </span>
      ) : null}
    </p>
  );
}
