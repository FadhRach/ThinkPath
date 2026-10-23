import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-display-2 font-extrabold tracking-tight text-foreground">Halaman tidak ditemukan</h1>
        <p className="text-body text-muted-foreground">
          Alamat yang kamu buka tidak ada, atau kamu tidak punya akses ke halaman itu.
        </p>
        <Button asChild size="lg">
          <Link href="/">Kembali ke beranda</Link>
        </Button>
      </div>
    </main>
  );
}
