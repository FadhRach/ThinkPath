import { SidebarShell } from "@/components/layout/SidebarShell";
import type { Role } from "@/lib/types";

interface AppShellProps {
  role: Role;
  /** Chip pengguna di topbar, di-stream dari layout lewat Suspense. */
  userMenu: React.ReactNode;
  children: React.ReactNode;
}

/** Mahasiswa dan dosen memakai kerangka sidebar yang sama; hanya menunya yang berbeda. */
export function AppShell({ role, userMenu, children }: AppShellProps) {
  return (
    <SidebarShell role={role} userMenu={userMenu}>
      {children}
    </SidebarShell>
  );
}
