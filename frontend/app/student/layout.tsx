import { redirect } from "next/navigation";

import { AppShell } from "@/components/common/AppShell";
import { ApiError } from "@/lib/api";
import { getMe } from "@/lib/data";

export default async function StudentLayout({
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

  if (me.role !== "student") {
    redirect("/dashboard");
  }

  return (
    <AppShell role="student" displayName={me.display_name ?? ""} email={me.email}>
      {children}
    </AppShell>
  );
}
