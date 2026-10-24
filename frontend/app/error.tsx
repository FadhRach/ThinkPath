"use client";

import { ErrorBoundaryPage } from "@/components/shared/ErrorBoundaryPage";

export default function RootError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryPage {...props} layout="screen" homeHref="/" />;
}
