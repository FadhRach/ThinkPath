import { Footer } from "@/components/common/Footer";
import { TopNav } from "@/components/common/TopNav";
import type { Role } from "@/lib/types";

interface Props {
  role: Role;
  /** Chip pengguna di kanan nav — di-stream dari layout lewat Suspense. */
  userMenu: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ role, userMenu, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopNav role={role} userMenu={userMenu} />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
