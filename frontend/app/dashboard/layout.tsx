import { redirect } from "next/navigation";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { getMe } from "@/lib/data";
import { ApiError } from "@/lib/api";

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

  return (
    <div className="min-h-screen flex bg-paper text-ink">
      <Sidebar displayName={me.display_name ?? ""} email={me.email} />
      <main className="flex-1 px-12 py-8">{children}</main>
    </div>
  );
}
