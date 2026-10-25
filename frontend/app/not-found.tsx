import Link from "next/link";

import { StatusPage } from "@/components/shared/StatusPage";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <StatusPage
      kind="not-found"
      layout="screen"
      actions={
        <Button asChild size="lg">
          <Link href="/">Kembali ke beranda</Link>
        </Button>
      }
    />
  );
}
