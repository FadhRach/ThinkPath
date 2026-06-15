import type { ReactNode } from "react";

interface Props {
  title: string;
  caption: string;
  action?: ReactNode;
}

export function EmptyState({ title, caption, action }: Props) {
  return (
    <div className="border border-dashed border-border rounded-card px-8 py-14 text-center bg-paper-elevated">
      <h2 className="font-display text-display-2 mb-2">{title}</h2>
      <p className="text-body text-ink-muted max-w-md mx-auto">{caption}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
