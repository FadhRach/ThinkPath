import { PageSkeleton } from "@/components/common/PageSkeleton";

// Fallback untuk semua rute /student/* yang tidak punya loading.tsx sendiri.
export default function Loading() {
  return <PageSkeleton variant="cards" />;
}
