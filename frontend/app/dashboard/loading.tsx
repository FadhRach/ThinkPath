import { PageSkeleton } from "@/components/common/PageSkeleton";

// Fallback untuk semua rute /dashboard/* yang tidak punya loading.tsx sendiri.
// Kehadiran loading boundary juga mengaktifkan kembali prefetch <Link> pada
// rute dinamis, jadi jangan dihapus.
export default function Loading() {
  return <PageSkeleton variant="cards" />;
}
