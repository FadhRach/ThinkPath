"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

// TipTap, ProseMirror, dan KaTeX cukup besar; dimuat hanya saat editor atau tampilan baca dipakai.
const fallback = () => <Skeleton className="h-72 w-full rounded-none" />;

export const LazyRichEditor = dynamic(
  () => import("@/features/editor/components/RichEditor").then((module) => module.RichEditor),
  { ssr: false, loading: fallback },
);

export const LazyRichContent = dynamic(
  () => import("@/features/editor/components/RichContent").then((module) => module.RichContent),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> },
);
