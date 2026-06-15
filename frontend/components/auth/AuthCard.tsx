import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  title: string;
  caption: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthCard({ eyebrow, title, caption, children, footer }: Props) {
  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-3 text-center">
          <p className="caption-eyebrow">{eyebrow}</p>
          <h1 className="font-display text-display-2">{title}</h1>
          <p className="text-body-sm text-ink-muted">{caption}</p>
        </header>
        <section className="bg-paper-elevated border border-border rounded-card p-6 space-y-5">
          {children}
        </section>
        <p className="text-center text-body-sm text-ink-muted">{footer}</p>
      </div>
    </main>
  );
}
