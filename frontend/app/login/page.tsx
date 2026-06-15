import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function LoginPage() {
  return (
    <AuthCard
      eyebrow="ThinkPath"
      title="Masuk ke dashboard"
      caption="Pakai akun guru kamu untuk meninjau bukti integritas siswa."
      footer={
        <>
          Belum punya akun?{" "}
          <Link href="/register" className="text-accent">
            Daftar di sini
          </Link>
        </>
      }
    >
      <EmailPasswordForm mode="login" />
      <AuthDivider label="atau" />
      <GoogleButton />
    </AuthCard>
  );
}
