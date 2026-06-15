import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function RegisterPage() {
  return (
    <AuthCard
      eyebrow="ThinkPath"
      title="Buat akun guru"
      caption="Mulai pantau pola berpikir siswa dengan bukti yang bisa ditinjau."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href="/login" className="text-accent">
            Masuk
          </Link>
        </>
      }
    >
      <EmailPasswordForm mode="register" />
      <AuthDivider label="atau" />
      <GoogleButton />
    </AuthCard>
  );
}
