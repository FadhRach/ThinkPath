import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

interface TaskIndicatorProps {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}

export function TaskIndicator({ title, description, href, linkLabel }: TaskIndicatorProps) {
  return (
    <section
      aria-label="Fokus berikutnya"
      className="relative isolate overflow-hidden rounded-2xl border border-brand-teal/30 bg-foreground bg-gradient-to-br from-foreground via-foreground to-brand-teal p-6 text-white shadow-soft sm:p-7"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-2/3 opacity-20 [background-image:radial-gradient(hsl(var(--brand-mint))_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_right,transparent,black)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-24 -z-10 h-72 w-72 rounded-full border border-brand-mint/20 sm:right-16" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 right-5 -z-10 h-28 w-28 rounded-full border border-brand-mint/20" />
      <p className="inline-flex items-center gap-2 rounded-full border border-brand-mint/30 bg-brand-mint/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-brand-mint">
        <Sparkles aria-hidden="true" className="h-3 w-3" />
        Fokus berikutnya
      </p>
      <h2 className="mt-3 max-w-2xl text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-mint">{description}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-brand-mint underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint focus-visible:ring-offset-4 focus-visible:ring-offset-foreground">
        {linkLabel}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </section>
  );
}
