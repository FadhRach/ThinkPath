import Link from "next/link";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthLayout
      title="Buat kata sandi baru"
      caption="Tautan dari email hanya bisa dipakai sekali."
      footer={
        <Link href="/login" className="font-semibold text-primary">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <ResetPasswordForm token={token ?? ""} />
    </AuthLayout>
  );
}
