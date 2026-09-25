"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_CLASSES as ALL } from "@/lib/calendar";

interface Props {
  classes: Array<{ id: string; name: string }>;
  selected: string | null;
  /** Alamat tujuan per pilihan, dirakit server supaya tanggal dan tampilan ikut terbawa. */
  hrefs: Record<string, string>;
}

export function ClassFilter({ classes, selected, hrefs }: Props) {
  const router = useRouter();
  return (
    <Select value={selected ?? ALL} onValueChange={(value) => router.push(hrefs[value])}>
      <SelectTrigger aria-label="Saring per kelas" className="h-9 w-full bg-card sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={ALL}>Semua kelas</SelectItem>
        {classes.map((cls) => (
          <SelectItem key={cls.id} value={cls.id}>
            {cls.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
