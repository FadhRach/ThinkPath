import Link from "next/link";

import { Brandmark } from "@/components/common/Brandmark";
import { Button } from "@/components/ui/button";
import { readAuthClaims } from "@/lib/auth-claims";

/**
 * Header halaman publik seperti Kebijakan Privasi. Pengunjung yang sudah
 * masuk diberi jalan kembali ke aplikasi, yang belum diberi Masuk dan Daftar.
 */
export function PublicHeader() {
  const claims = readAuthClaims();
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Brandmark />
        </Link>
        <div className="flex items-center gap-2">
          {claims ? (
            <Button asChild variant="outline">
              <Link href={claims.role === "teacher" ? "/dashboard" : "/student"}>
                Kembali ke ThinkPath
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Masuk</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Daftar</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
