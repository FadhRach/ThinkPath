import { PageSkeleton } from "@/components/shared/PageSkeleton";

// Fallback untuk semua rute /student/* yang tidak punya loading.tsx sendiri.
export default function Loading() {
  return <PageSkeleton variant="cards" />;
}
