"use client";

import { ErrorBoundaryPage } from "@/components/shared/ErrorBoundaryPage";

export default function StudentError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryPage {...props} kind="offline" title="Data gagal dimuat" homeHref="/student" />
  );
}
