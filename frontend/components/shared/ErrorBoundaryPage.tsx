"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

import { RetryButton } from "./RetryButton";
import { StatusPage, type StatusKind } from "./StatusPage";

interface ErrorBoundaryPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  kind?: Extract<StatusKind, "error" | "offline">;
  title?: string;
  description?: string;
  /** Tujuan tombol "Kembali"; kosong berarti tombol itu tidak ditampilkan. */
  homeHref?: string;
  layout?: "screen" | "inline";
}

/** Isi standar file error.tsx: satu komponen, tiap area hanya memberi teks dan tujuan. */
export function ErrorBoundaryPage({
  error,
  reset,
  kind = "error",
  title,
  description,
  homeHref,
  layout,
}: ErrorBoundaryPageProps) {
  return (
    <StatusPage
      kind={kind}
      title={title}
      description={description}
      digest={error.digest}
      layout={layout}
      actions={
        <>
          <RetryButton reset={reset} />
          {homeHref ? (
            <Button asChild variant="outline">
              <Link href={homeHref}>Kembali</Link>
            </Button>
          ) : null}
        </>
      }
    />
  );
}
