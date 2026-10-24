import Link from "next/link";

import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Lupa kata sandi"
      caption="Masukkan email akunmu. Kami kirim tautan untuk membuat kata sandi baru."
      footer={
        <Link href="/login" className="font-semibold text-brand-ink">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
