import Link from "next/link";

import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { EmailPasswordForm } from "@/features/auth/components/EmailPasswordForm";
import { PolicyArticle } from "@/features/privacy/components/PolicyArticle";

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Buat akun ThinkPath"
      caption="Daftar sebagai dosen untuk mengelola kelas, atau sebagai mahasiswa untuk mengumpulkan tugas."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href="/login" className="font-semibold text-brand-ink">
            Masuk
          </Link>
        </>
      }
    >
      <EmailPasswordForm mode="register" policy={<PolicyArticle />} />
    </AuthLayout>
  );
}
