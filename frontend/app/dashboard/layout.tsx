import { redirect } from "next/navigation";

import { AppShell } from "@/components/common/AppShell";
import { getMe } from "@/lib/data";
import { ApiError } from "@/lib/api";

// Halaman guru bergantung pada cookie auth per-request, jadi tidak boleh
// di-prerender statis saat build.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let me;
  try {
    me = await getMe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }

  if (me.role !== "teacher") {
    redirect("/student");
  }

  return (
    <AppShell role="teacher" displayName={me.display_name ?? ""} email={me.email}>
      {children}
    </AppShell>
  );
}
