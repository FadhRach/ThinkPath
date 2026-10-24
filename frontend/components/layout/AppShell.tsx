import { Footer } from "@/components/layout/Footer";
import { StudentShell } from "@/components/layout/StudentShell";
import { TopNav } from "@/components/layout/TopNav";
import type { Role } from "@/lib/types";

interface AppShellProps {
  role: Role;
  /** Chip pengguna di kanan nav, di-stream dari layout lewat Suspense. */
  userMenu: React.ReactNode;
  children: React.ReactNode;
}

/** Mahasiswa memakai sidebar; dosen masih memakai navigasi atas. */
export function AppShell({ role, userMenu, children }: AppShellProps) {
  if (role === "student") return <StudentShell userMenu={userMenu}>{children}</StudentShell>;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopNav role={role} userMenu={userMenu} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
