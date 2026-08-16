import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/common/AppShell";
import { NavUserSection, NavUserSkeleton } from "@/components/common/NavUserSection";
import { readAuthClaims } from "@/lib/auth-claims";

// Halaman mahasiswa bergantung pada cookie auth per-request, jadi tidak boleh
// di-prerender statis saat build.
export const dynamic = "force-dynamic";

// Peran dibaca dari klaim JWT tanpa panggilan jaringan, sehingga shell dan
// skeleton halaman tampil seketika; /api/me di-stream lewat NavUserSection
// dan berjalan paralel dengan fetch halaman.
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const claims = readAuthClaims();
  if (!claims) redirect("/login");
  if (claims.role !== "student") redirect("/dashboard");

  return (
    <AppShell
      role="student"
      userMenu={
        <Suspense fallback={<NavUserSkeleton />}>
          <NavUserSection role="student" fallbackEmail={claims.email} />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
