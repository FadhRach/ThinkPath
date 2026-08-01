"use client";

import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  caption: string;
  onRetry: () => void;
}

export function ErrorState({ title, caption, onRetry }: Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <h2 className="text-display-2 font-bold text-foreground">{title}</h2>
        <p className="text-body text-muted-foreground">{caption}</p>
        <Button type="button" onClick={onRetry}>
          Coba lagi
        </Button>
      </div>
    </div>
  );
}
