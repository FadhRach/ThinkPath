import Link from "next/link";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";

export default function LoginPage() {
  return (
    <AuthLayout
      title="Selamat datang kembali"
      caption="Masuk untuk melanjutkan ke dashboard kamu."
      footer={
        <>
          Belum punya akun?{" "}
          <Link href="/register" className="font-semibold text-primary">
            Daftar di sini
          </Link>
        </>
      }
    >
      <EmailPasswordForm mode="login" />
    </AuthLayout>
  );
}
