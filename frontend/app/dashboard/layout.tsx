import { RoleLayout } from "@/components/layout/RoleLayout";

// Halaman bergantung pada cookie auth per-request, jadi tidak boleh di-prerender statis saat build.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="teacher">{children}</RoleLayout>;
}
