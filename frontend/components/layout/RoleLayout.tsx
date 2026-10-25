import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { NavUserSection, NavUserSkeleton } from "@/components/layout/NavUserSection";
import { readAuthClaims } from "@/lib/auth-claims";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";
import type { Role } from "@/lib/types";

const HOME: Record<Role, string> = { teacher: "/dashboard", student: "/student" };

/**
 * Layout bersama untuk area dosen (/dashboard) dan mahasiswa (/student).
 *
 * Peran dibaca dari klaim JWT tanpa panggilan jaringan, sehingga shell dan skeleton
 * halaman tampil seketika; /api/me di-stream lewat NavUserSection dan berjalan paralel
 * dengan fetch halaman. Halaman bergantung pada cookie per-request, jadi layout
 * pemanggil wajib mengekspor `dynamic = "force-dynamic"`.
 */
export async function RoleLayout({ role, children }: { role: Role; children: React.ReactNode }) {
  const claims = await readAuthClaims();
  if (!claims) redirect("/login");
  if (claims.role !== role) redirect(HOME[claims.role]);
  // Belum menyetujui versi kebijakan yang berlaku: baca dan setujui dulu.
  if (claims.consent !== PRIVACY_POLICY_VERSION) redirect("/persetujuan");

  return (
    <AppShell
      role={role}
      userMenu={
        <Suspense fallback={<NavUserSkeleton />}>
          <NavUserSection role={role} fallbackEmail={claims.email} />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
