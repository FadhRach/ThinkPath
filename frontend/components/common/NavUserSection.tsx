import { NavUser } from "@/components/common/NavUser";
import { Skeleton } from "@/components/ui/skeleton";
import { getMe } from "@/lib/data";
import type { Role } from "@/lib/types";

interface Props {
  role: Role;
  /** Email dari klaim JWT, dipakai bila /api/me gagal sementara. */
  fallbackEmail: string;
}

const ROLE_LABEL: Record<Role, string> = {
  teacher: "Dosen",
  student: "Mahasiswa",
};

// Komponen server yang di-stream lewat Suspense: shell navigasi tampil dulu,
// nama pengguna menyusul, dan fetch halaman berjalan paralel dengan /api/me.
export async function NavUserSection({ role, fallbackEmail }: Props) {
  let displayName = "";
  let email = fallbackEmail;

  try {
    const me = await getMe();
    displayName = me.display_name ?? "";
    email = me.email;
  } catch (error) {
    // redirect()/notFound() dari apiFetch harus tetap menjalar.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest: unknown }).digest).startsWith("NEXT_")
    ) {
      throw error;
    }
    // Kegagalan lain: chip tampil dengan email dari token, shell tetap hidup.
  }

  return (
    <NavUser
      displayName={displayName}
      email={email}
      roleLabel={ROLE_LABEL[role]}
      settingsHref={role === "teacher" ? "/dashboard/pengaturan" : "/student/pengaturan"}
    />
  );
}

export function NavUserSkeleton() {
  return (
    <span className="flex items-center gap-2.5 py-1 pl-1 pr-2">
      <Skeleton className="h-9 w-9 rounded-full" />
      <span className="hidden space-y-1 sm:block">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-14" />
      </span>
    </span>
  );
}
