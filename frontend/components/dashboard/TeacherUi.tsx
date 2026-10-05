import { type LucideIcon } from "lucide-react";
import Link from "next/link";

export function TeacherStat({ label, value }: {
  icon: LucideIcon; label: string; value: number; tone?: "teal" | "coral" | "indigo";
}) {
  return (
    <div className="min-w-0 border-l border-border px-5 first:border-l-0 first:pl-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function TeacherSectionHeading({ title, href, linkLabel }: {
  title: string; eyebrow?: string; href?: string; linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {href ? <Link href={href} className="shrink-0 text-sm text-accent-foreground underline-offset-4 hover:underline">{linkLabel} <span aria-hidden="true">→</span></Link> : null}
    </div>
  );
}
