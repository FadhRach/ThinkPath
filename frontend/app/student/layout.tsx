import { RoleLayout } from "@/components/layout/RoleLayout";

// Halaman bergantung pada cookie auth per-request, jadi tidak boleh di-prerender statis saat build.
export const dynamic = "force-dynamic";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="student">{children}</RoleLayout>;
}
