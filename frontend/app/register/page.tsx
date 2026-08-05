import Link from "next/link";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Buat akun ThinkPath"
      caption="Daftar sebagai dosen untuk mengelola kelas, atau sebagai mahasiswa untuk mengumpulkan tugas."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href="/login" className="font-semibold text-primary">
            Masuk
          </Link>
        </>
      }
    >
      <EmailPasswordForm mode="register" />
    </AuthLayout>
  );
}
