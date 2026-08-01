import type { ReactNode } from "react";

interface Props {
  title: string;
  caption: string;
  action?: ReactNode;
}

export function EmptyState({ title, caption, action }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-8 py-14 text-center">
      <h2 className="mb-2 text-display-2 font-bold text-foreground">{title}</h2>
      <p className="mx-auto max-w-md text-body text-muted-foreground">{caption}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
