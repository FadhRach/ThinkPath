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
          <span className="mt-3 block text-caption text-muted-foreground">
            Setelah mendaftar, kamu akan diminta membaca dan menyetujui{" "}
            <Link href="/kebijakan-privasi" className="font-semibold text-primary">
              Kebijakan Privasi
            </Link>{" "}
            sebelum memakai ThinkPath.
          </span>
        </>
      }
    >
      <EmailPasswordForm mode="register" />
    </AuthLayout>
  );
}
