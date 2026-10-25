"use client";

import { ErrorBoundaryPage } from "@/components/shared/ErrorBoundaryPage";

export default function DashboardError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryPage
      {...props}
      kind="offline"
      title="Data dasbor gagal dimuat"
      homeHref="/dashboard"
    />
  );
}
