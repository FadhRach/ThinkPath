import Link from "next/link";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Lupa kata sandi"
      caption="Masukkan email akunmu. Kami kirim tautan untuk membuat kata sandi baru."
      footer={
        <Link href="/login" className="font-semibold text-primary">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
