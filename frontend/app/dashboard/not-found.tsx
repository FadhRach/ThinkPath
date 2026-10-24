import Link from "next/link";

import { StatusPage } from "@/components/shared/StatusPage";
import { Button } from "@/components/ui/button";

// Di dalam shell: navigasi atas tetap tampil, hanya isi halaman yang diganti.
export default function NotFound() {
  return (
    <StatusPage
      kind="not-found"
      description="Halaman yang kamu buka tidak ada, atau kamu tidak punya akses ke data itu."
      actions={
        <Button asChild>
          <Link href="/dashboard">Kembali ke dasbor</Link>
        </Button>
      }
    />
  );
}
