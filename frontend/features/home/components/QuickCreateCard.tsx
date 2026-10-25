import { ClipboardPlus, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Dua aksi yang paling sering dilakukan dosen, di sebelah sapaan supaya langsung terlihat. */
export function QuickCreateCard() {
  return (
    <div className="flex gap-2">
      <Button asChild>
        <Link href="/dashboard/tugas/new">
          <ClipboardPlus /> Buat tugas
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/dashboard/classes/new">
          <Plus /> Buat kelas
        </Link>
      </Button>
    </div>
  );
}
